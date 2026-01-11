// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title StakingRewards
 * @dev Multi-pool staking contract for LP tokens
 * Users stake LP tokens to earn DOC reward tokens
 * Supports multiple pools with different reward rates
 */
contract StakingRewards is ReentrancyGuard, Ownable, Pausable {
    using SafeERC20 for IERC20;

    // Reward token (DOC)
    IERC20 public immutable rewardToken;

    // Pool info
    struct PoolInfo {
        address lpToken;           // LP token address for this pool
        uint256 rewardRate;        // DOC tokens per second for this pool
        uint256 lastUpdateTime;    // Last time reward was calculated
        uint256 rewardPerTokenStored; // Accumulated rewards per token
        uint256 totalStaked;       // Total LP tokens staked
        bool isActive;             // Whether pool is active
    }

    // User info
    struct UserInfo {
        uint256 stakedAmount;      // LP tokens staked by user
        uint256 rewardPerTokenPaid; // Reward per token when user last updated
        uint256 rewards;           // Accumulated rewards
    }

    // Mapping: pool address => pool info
    mapping(address => PoolInfo) public pools;

    // Mapping: pool address => user address => user info
    mapping(address => mapping(address => UserInfo)) public userInfo;

    // All registered pools
    address[] public poolList;

    // Claiming control
    bool public claimingEnabled = false; // Disabled by default for future airdrop

    // Events
    event PoolAdded(address indexed pool, address indexed lpToken, uint256 rewardRate);
    event PoolUpdated(address indexed pool, uint256 newRewardRate);
    event PoolDeactivated(address indexed pool);
    event Staked(address indexed pool, address indexed user, uint256 amount);
    event Unstaked(address indexed pool, address indexed user, uint256 amount);
    event RewardClaimed(address indexed pool, address indexed user, uint256 amount);
    event RewardRateUpdated(address indexed pool, uint256 newRate);

    constructor(address _rewardToken) Ownable(msg.sender) {
        require(_rewardToken != address(0), "Invalid reward token");
        rewardToken = IERC20(_rewardToken);
    }

    /**
     * @dev Add a new pool for staking
     * @param poolAddress Address of the pool contract
     * @param lpTokenAddress Address of the LP token (same as pool address if pool is ERC20)
     * @param rewardRate DOC tokens per second for this pool
     */
    function addPool(
        address poolAddress,
        address lpTokenAddress,
        uint256 rewardRate
    ) external onlyOwner {
        require(poolAddress != address(0), "Invalid pool address");
        require(lpTokenAddress != address(0), "Invalid LP token address");
        require(!pools[poolAddress].isActive, "Pool already exists");

        pools[poolAddress] = PoolInfo({
            lpToken: lpTokenAddress,
            rewardRate: rewardRate,
            lastUpdateTime: block.timestamp,
            rewardPerTokenStored: 0,
            totalStaked: 0,
            isActive: true
        });

        poolList.push(poolAddress);
        emit PoolAdded(poolAddress, lpTokenAddress, rewardRate);
    }

    /**
     * @dev Update reward rate for a pool
     * @param poolAddress Pool address
     * @param newRewardRate New DOC tokens per second
     */
    function updateRewardRate(address poolAddress, uint256 newRewardRate) external onlyOwner {
        require(pools[poolAddress].isActive, "Pool not active");
        
        // Update pool rewards before changing rate
        _updatePoolRewards(poolAddress);
        
        pools[poolAddress].rewardRate = newRewardRate;
        emit RewardRateUpdated(poolAddress, newRewardRate);
    }

    /**
     * @dev Update reward rate for all active pools at once
     * @param newRewardRate New DOC tokens per second for all pools
     */
    function updateAllPoolsRewardRate(uint256 newRewardRate) external onlyOwner {
        for (uint256 i = 0; i < poolList.length; i++) {
            address poolAddress = poolList[i];
            if (pools[poolAddress].isActive) {
                _updatePoolRewards(poolAddress);
                pools[poolAddress].rewardRate = newRewardRate;
                emit RewardRateUpdated(poolAddress, newRewardRate);
            }
        }
    }

    /**
     * @dev Deactivate a pool (stop new stakes, allow unstakes)
     * @param poolAddress Pool address
     */
    function deactivatePool(address poolAddress) external onlyOwner {
        require(pools[poolAddress].isActive, "Pool not active");
        
        _updatePoolRewards(poolAddress);
        pools[poolAddress].isActive = false;
        pools[poolAddress].rewardRate = 0; // Stop accumulating rewards
        
        emit PoolDeactivated(poolAddress);
    }

    /**
     * @dev Update pool rewards (internal)
     */
    function _updatePoolRewards(address poolAddress) internal {
        PoolInfo storage pool = pools[poolAddress];
        
        if (pool.totalStaked == 0) {
            pool.lastUpdateTime = block.timestamp;
            return;
        }

        uint256 timeElapsed = block.timestamp - pool.lastUpdateTime;
        if (timeElapsed > 0) {
            uint256 reward = pool.rewardRate * timeElapsed;
            pool.rewardPerTokenStored += (reward * 1e18) / pool.totalStaked;
        }
        
        pool.lastUpdateTime = block.timestamp;
    }

    /**
     * @dev Update user rewards (internal)
     */
    function _updateUserRewards(address poolAddress, address user) internal {
        _updatePoolRewards(poolAddress);
        
        UserInfo storage userData = userInfo[poolAddress][user];
        PoolInfo storage pool = pools[poolAddress];
        
        if (userData.stakedAmount > 0) {
            uint256 rewardPerToken = pool.rewardPerTokenStored - userData.rewardPerTokenPaid;
            userData.rewards += (userData.stakedAmount * rewardPerToken) / 1e18;
        }
        
        userData.rewardPerTokenPaid = pool.rewardPerTokenStored;
    }

    /**
     * @dev Stake LP tokens
     * @param poolAddress Pool address
     * @param amount Amount of LP tokens to stake
     */
    function stake(address poolAddress, uint256 amount) external nonReentrant whenNotPaused {
        require(pools[poolAddress].isActive, "Pool not active");
        require(amount > 0, "Amount must be greater than 0");

        PoolInfo storage pool = pools[poolAddress];
        UserInfo storage userData = userInfo[poolAddress][msg.sender];

        // Update rewards before staking
        _updateUserRewards(poolAddress, msg.sender);

        // Transfer LP tokens from user
        IERC20(pool.lpToken).safeTransferFrom(msg.sender, address(this), amount);

        // Update staking amounts
        userData.stakedAmount += amount;
        pool.totalStaked += amount;

        emit Staked(poolAddress, msg.sender, amount);
    }

    /**
     * @dev Unstake LP tokens
     * @param poolAddress Pool address
     * @param amount Amount of LP tokens to unstake
     */
    function unstake(address poolAddress, uint256 amount) external nonReentrant whenNotPaused {
        require(amount > 0, "Amount must be greater than 0");

        PoolInfo storage pool = pools[poolAddress];
        UserInfo storage userData = userInfo[poolAddress][msg.sender];

        require(userData.stakedAmount >= amount, "Insufficient staked amount");

        // Update rewards before unstaking
        _updateUserRewards(poolAddress, msg.sender);

        // Update staking amounts
        userData.stakedAmount -= amount;
        pool.totalStaked -= amount;

        // Transfer LP tokens back to user
        IERC20(pool.lpToken).safeTransfer(msg.sender, amount);

        emit Unstaked(poolAddress, msg.sender, amount);
    }

    /**
     * @dev Claim accumulated rewards
     * @param poolAddress Pool address
     * Note: Claiming is disabled by default. Owner must enable it.
     */
    function claimRewards(address poolAddress) external nonReentrant {
        require(claimingEnabled, "Claiming is currently disabled");
        
        _updateUserRewards(poolAddress, msg.sender);

        UserInfo storage userData = userInfo[poolAddress][msg.sender];
        uint256 rewardAmount = userData.rewards;

        if (rewardAmount > 0) {
            userData.rewards = 0;
            rewardToken.safeTransfer(msg.sender, rewardAmount);
            emit RewardClaimed(poolAddress, msg.sender, rewardAmount);
        }
    }

    /**
     * @dev Claim rewards from all pools
     * Note: Claiming is disabled by default. Owner must enable it.
     */
    function claimAllRewards() external nonReentrant {
        require(claimingEnabled, "Claiming is currently disabled");
        
        for (uint256 i = 0; i < poolList.length; i++) {
            address poolAddress = poolList[i];
            if (pools[poolAddress].isActive || userInfo[poolAddress][msg.sender].stakedAmount > 0) {
                _updateUserRewards(poolAddress, msg.sender);
                
                UserInfo storage userData = userInfo[poolAddress][msg.sender];
                uint256 rewardAmount = userData.rewards;

                if (rewardAmount > 0) {
                    userData.rewards = 0;
                    rewardToken.safeTransfer(msg.sender, rewardAmount);
                    emit RewardClaimed(poolAddress, msg.sender, rewardAmount);
                }
            }
        }
    }

    /**
     * @dev Get pending rewards for a user in a pool
     * @param poolAddress Pool address
     * @param user User address
     * @return Pending reward amount
     */
    function getPendingRewards(address poolAddress, address user) external view returns (uint256) {
        PoolInfo storage pool = pools[poolAddress];
        UserInfo storage userData = userInfo[poolAddress][user];

        if (!pool.isActive || userData.stakedAmount == 0) {
            return userData.rewards;
        }

        uint256 rewardPerTokenStored = pool.rewardPerTokenStored;
        
        if (pool.totalStaked > 0) {
            uint256 timeElapsed = block.timestamp - pool.lastUpdateTime;
            uint256 reward = pool.rewardRate * timeElapsed;
            rewardPerTokenStored += (reward * 1e18) / pool.totalStaked;
        }

        uint256 rewardPerToken = rewardPerTokenStored - userData.rewardPerTokenPaid;
        uint256 pending = (userData.stakedAmount * rewardPerToken) / 1e18;

        return userData.rewards + pending;
    }

    /**
     * @dev Get user's staked amount in a pool
     * @param poolAddress Pool address
     * @param user User address
     * @return Staked amount
     */
    function getUserStaked(address poolAddress, address user) external view returns (uint256) {
        return userInfo[poolAddress][user].stakedAmount;
    }

    /**
     * @dev Get total staked in a pool
     * @param poolAddress Pool address
     * @return Total staked amount
     */
    function getTotalStaked(address poolAddress) external view returns (uint256) {
        return pools[poolAddress].totalStaked;
    }

    /**
     * @dev Get pool info
     * @param poolAddress Pool address
     * @return Pool info struct
     */
    function getPoolInfo(address poolAddress) external view returns (PoolInfo memory) {
        return pools[poolAddress];
    }

    /**
     * @dev Get all pool addresses
     * @return Array of pool addresses
     */
    function getAllPools() external view returns (address[] memory) {
        return poolList;
    }

    /**
     * @dev Enable or disable claiming (only owner)
     * @param enabled Whether claiming should be enabled
     */
    function setClaimingEnabled(bool enabled) external onlyOwner {
        claimingEnabled = enabled;
        emit ClaimingEnabledUpdated(enabled);
    }

    /**
     * @dev Get all stakers for a pool with their accumulated rewards
     * Useful for airdrop distribution
     * @notice This function reverts to indicate that off-chain indexing should be used
     * @dev This requires iterating through all possible addresses, which is gas-intensive
     * For production, use events or off-chain indexing to get all stakers
     */
    function getAllStakersWithRewards() 
        external 
        pure 
    {
        revert("Use events or off-chain indexing to get all stakers");
    }

    /**
     * @dev Get staker info for a specific user in a pool
     * @param poolAddress Pool address
     * @param user User address
     * @return stakedAmount Amount of LP tokens staked
     * @return accumulatedRewards Total DOC rewards accumulated (not yet claimed)
     */
    function getStakerInfo(address poolAddress, address user) 
        external 
        view 
        returns (uint256 stakedAmount, uint256 accumulatedRewards) 
    {
        UserInfo storage userData = userInfo[poolAddress][user];
        
        // Calculate current accumulated rewards
        PoolInfo storage pool = pools[poolAddress];
        uint256 rewardPerTokenStored = pool.rewardPerTokenStored;
        
        if (pool.totalStaked > 0 && pool.isActive) {
            uint256 timeElapsed = block.timestamp - pool.lastUpdateTime;
            uint256 reward = pool.rewardRate * timeElapsed;
            rewardPerTokenStored += (reward * 1e18) / pool.totalStaked;
        }
        
        uint256 rewardPerToken = rewardPerTokenStored - userData.rewardPerTokenPaid;
        uint256 pending = (userData.stakedAmount * rewardPerToken) / 1e18;
        uint256 totalAccumulated = userData.rewards + pending;
        
        return (userData.stakedAmount, totalAccumulated);
    }

    /**
     * @dev Emergency: Withdraw reward tokens (only owner)
     * @param amount Amount to withdraw
     */
    function emergencyWithdrawRewards(uint256 amount) external onlyOwner {
        rewardToken.safeTransfer(owner(), amount);
    }

    /**
     * @dev Pause the contract (only owner)
     * Prevents new stakes and unstakes, but rewards continue accumulating
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @dev Unpause the contract (only owner)
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @dev Get number of pools
     * @return Number of pools
     */
    function poolCount() external view returns (uint256) {
        return poolList.length;
    }

    // Additional events
    event ClaimingEnabledUpdated(bool enabled);
    // Pausable events are inherited from Pausable.sol
}
