// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./FuturePoolWithProtocolFee.sol";

/**
 * @title FuturePoolFactory
 * @dev Factory contract to create pools with protocol fees (SushiSwap model)
 * 
 * This factory deploys FuturePoolWithProtocolFee contracts that collect:
 * - 0.05% protocol fee (goes to treasury)
 * - 0.25% LP fee (stays in pool for liquidity providers)
 * 
 * Total swap fee: 0.3%
 */
contract FuturePoolFactory {
    // Mapping: tokenA => tokenB => pool address
    mapping(address => mapping(address => address)) public pools;
    
    // All pools created
    address[] public allPools;
    
    // Protocol fee recipient (treasury/team wallet)
    // This will be set during deployment and can be updated by owner
    address public protocolFeeRecipient;
    
    // Owner address (can update protocolFeeRecipient)
    address public owner;
    
    event PoolCreated(address indexed tokenA, address indexed tokenB, address pool, uint256);
    event ProtocolFeeRecipientUpdated(address indexed oldRecipient, address indexed newRecipient);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }
    
    /**
     * @dev Constructor
     * @param _protocolFeeRecipient Address to receive protocol fees from all pools
     */
    constructor(address _protocolFeeRecipient) {
        require(_protocolFeeRecipient != address(0), "Zero protocol fee recipient");
        protocolFeeRecipient = _protocolFeeRecipient;
        owner = msg.sender;
    }
    
    /**
     * @dev Create a new pool for token pair
     * @param tokenA Address of first token
     * @param tokenB Address of second token
     * @return pool Address of created pool
     */
    function createPool(address tokenA, address tokenB) external returns (address pool) {
        require(tokenA != tokenB, "Identical tokens");
        require(tokenA != address(0) && tokenB != address(0), "Zero address");
        
        // Ensure consistent ordering
        (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        
        require(pools[token0][token1] == address(0), "Pool exists");
        
        // Deploy new pool with protocol fee recipient
        pool = address(new FuturePoolWithProtocolFee(token0, token1, protocolFeeRecipient));
        
        pools[token0][token1] = pool;
        pools[token1][token0] = pool; // Populate reverse mapping
        allPools.push(pool);
        
        emit PoolCreated(token0, token1, pool, allPools.length);
    }
    
    /**
     * @dev Get pool address for token pair
     */
    function getPool(address tokenA, address tokenB) external view returns (address pool) {
        (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        pool = pools[token0][token1];
    }
    
    /**
     * @dev Get total number of pools
     */
    function allPoolsLength() external view returns (uint256) {
        return allPools.length;
    }
    
    /**
     * @dev Update protocol fee recipient (affects new pools only)
     * Existing pools will continue using their original recipient
     * @param _newRecipient New protocol fee recipient address
     */
    function setProtocolFeeRecipient(address _newRecipient) external onlyOwner {
        require(_newRecipient != address(0), "Zero address");
        address oldRecipient = protocolFeeRecipient;
        protocolFeeRecipient = _newRecipient;
        emit ProtocolFeeRecipientUpdated(oldRecipient, _newRecipient);
    }
    
    /**
     * @dev Transfer ownership of factory
     * @param newOwner New owner address
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Zero address");
        address oldOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }
}

