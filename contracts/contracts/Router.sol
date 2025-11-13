// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./PoolFactory.sol";
import "./SimplePoolWithLP.sol";

/**
 * @title Router
 * @dev Router contract for multi-hop swaps
 * Works with existing pools - no need to redeploy pools or factory
 */
contract Router is ReentrancyGuard {
    using SafeERC20 for IERC20;
    
    PoolFactory public immutable factory;
    
    event SwapExecuted(
        address indexed user,
        address[] path,
        uint256 amountIn,
        uint256 amountOut
    );
    
    constructor(address _factory) {
        require(_factory != address(0), "Invalid factory");
        factory = PoolFactory(_factory);
    }
    
    /**
     * @dev Swap exact amount of input tokens for minimum output tokens
     * @param amountIn Exact amount of input tokens
     * @param amountOutMin Minimum amount of output tokens (slippage protection)
     * @param path Array of token addresses representing the swap path
     * @param to Address to receive output tokens
     * @return amounts Array of amounts at each step of the swap
     */
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to
    ) external nonReentrant returns (uint256[] memory amounts) {
        require(path.length >= 2, "Invalid path");
        require(to != address(0), "Invalid recipient");
        
        amounts = getAmountsOut(amountIn, path);
        require(amounts[amounts.length - 1] >= amountOutMin, "Insufficient output amount");
        
        // Transfer input tokens from user to router
        IERC20(path[0]).safeTransferFrom(msg.sender, address(this), amountIn);
        
        // Execute swaps through the path
        _swap(amounts, path, to);
        
        emit SwapExecuted(msg.sender, path, amountIn, amounts[amounts.length - 1]);
    }
    
    /**
     * @dev Swap tokens for exact amount of output tokens
     * @param amountOut Exact amount of output tokens desired
     * @param amountInMax Maximum amount of input tokens (slippage protection)
     * @param path Array of token addresses representing the swap path
     * @param to Address to receive output tokens
     * @return amounts Array of amounts at each step of the swap
     */
    function swapTokensForExactTokens(
        uint256 amountOut,
        uint256 amountInMax,
        address[] calldata path,
        address to
    ) external nonReentrant returns (uint256[] memory amounts) {
        require(path.length >= 2, "Invalid path");
        require(to != address(0), "Invalid recipient");
        
        amounts = getAmountsIn(amountOut, path);
        require(amounts[0] <= amountInMax, "Excessive input amount");
        
        // Transfer input tokens from user to router
        IERC20(path[0]).safeTransferFrom(msg.sender, address(this), amounts[0]);
        
        // Execute swaps through the path
        _swap(amounts, path, to);
        
        emit SwapExecuted(msg.sender, path, amounts[0], amountOut);
    }
    
    /**
     * @dev Internal function to execute swaps through the path
     */
    function _swap(
        uint256[] memory amounts,
        address[] memory path,
        address _to
    ) internal {
        uint256 pathLength = path.length;
        for (uint256 i; i < pathLength - 1; ) {
            address input = path[i];
            address output = path[i + 1];
            address pool = factory.getPool(input, output);
            require(pool != address(0), "Pool not found");
            
            SimplePoolWithLP poolContract = SimplePoolWithLP(pool);
            address tokenA = address(poolContract.tokenA());
            bool isTokenA = (input == tokenA);
            require(isTokenA || (input == address(poolContract.tokenB())), "Invalid token");
            
            IERC20(input).forceApprove(pool, amounts[i]);
            
            address recipient = (i < pathLength - 2) ? address(this) : _to;
            if (isTokenA) {
                poolContract.swapAToB(amounts[i], amounts[i + 1], recipient);
            } else {
                poolContract.swapBToA(amounts[i], amounts[i + 1], recipient);
            }
            
            unchecked { ++i; }
        }
    }
    
    /**
     * @dev Calculate output amounts for a given input amount and path
     * @param amountIn Input amount
     * @param path Array of token addresses
     * @return amounts Array of output amounts at each step
     */
    function getAmountsOut(uint256 amountIn, address[] calldata path)
        public
        view
        returns (uint256[] memory amounts)
    {
        require(path.length >= 2, "Invalid path");
        amounts = new uint256[](path.length);
        amounts[0] = amountIn;
        
        for (uint256 i; i < path.length - 1; i++) {
            address pool = factory.getPool(path[i], path[i + 1]);
            require(pool != address(0), "Pool not found");
            
            SimplePoolWithLP poolContract = SimplePoolWithLP(pool);
            address tokenA = address(poolContract.tokenA());
            address tokenB = address(poolContract.tokenB());
            
            bool isTokenA = (path[i] == tokenA);
            bool isTokenB = (path[i] == tokenB);
            require(isTokenA || isTokenB, "Invalid token");
            
            // Get reserves
            (uint256 reserveA, uint256 reserveB) = poolContract.getReserves();
            
            // Calculate output using Uniswap V2 formula
            uint256 reserveIn = isTokenA ? reserveA : reserveB;
            uint256 reserveOut = isTokenA ? reserveB : reserveA;
            
            amounts[i + 1] = getAmountOut(amounts[i], reserveIn, reserveOut);
        }
    }
    
    /**
     * @dev Calculate input amounts needed for a given output amount and path
     * @param amountOut Output amount
     * @param path Array of token addresses
     * @return amounts Array of input amounts at each step
     */
    function getAmountsIn(uint256 amountOut, address[] calldata path)
        public
        view
        returns (uint256[] memory amounts)
    {
        require(path.length >= 2, "Invalid path");
        amounts = new uint256[](path.length);
        amounts[amounts.length - 1] = amountOut;
        
        for (uint256 i = path.length - 1; i > 0; i--) {
            address pool = factory.getPool(path[i - 1], path[i]);
            require(pool != address(0), "Pool not found");
            
            SimplePoolWithLP poolContract = SimplePoolWithLP(pool);
            address tokenA = address(poolContract.tokenA());
            address tokenB = address(poolContract.tokenB());
            
            bool isTokenA = (path[i - 1] == tokenA);
            bool isTokenB = (path[i - 1] == tokenB);
            require(isTokenA || isTokenB, "Invalid token");
            
            // Get reserves
            (uint256 reserveA, uint256 reserveB) = poolContract.getReserves();
            
            // Calculate input using reverse Uniswap V2 formula
            uint256 reserveIn = isTokenA ? reserveA : reserveB;
            uint256 reserveOut = isTokenA ? reserveB : reserveA;
            
            amounts[i - 1] = getAmountIn(amounts[i], reserveIn, reserveOut);
        }
    }
    
    /**
     * @dev Calculate output amount for a swap (Uniswap V2 formula)
     */
    function getAmountOut(
        uint256 amountIn,
        uint256 reserveIn,
        uint256 reserveOut
    ) public pure returns (uint256 amountOut) {
        require(amountIn > 0, "Insufficient input amount");
        require(reserveIn > 0 && reserveOut > 0, "Insufficient liquidity");
        
        uint256 amountInWithFee = amountIn * 9970; // 0.3% fee (9970/10000)
        uint256 numerator = amountInWithFee * reserveOut;
        uint256 denominator = (reserveIn * 10000) + amountInWithFee;
        amountOut = numerator / denominator;
    }
    
    /**
     * @dev Calculate input amount needed for a swap (reverse Uniswap V2 formula)
     */
    function getAmountIn(
        uint256 amountOut,
        uint256 reserveIn,
        uint256 reserveOut
    ) public pure returns (uint256 amountIn) {
        require(amountOut > 0, "Insufficient output amount");
        require(reserveIn > 0 && reserveOut > 0, "Insufficient liquidity");
        
        uint256 numerator = reserveIn * amountOut * 10000;
        uint256 denominator = (reserveOut - amountOut) * 9970; // 0.3% fee
        amountIn = (numerator / denominator) + 1; // Add 1 to account for rounding
    }
    
    /**
     * @dev Find best path for a swap (simple implementation - checks direct and via USDC)
     * @param tokenIn Input token address
     * @param tokenOut Output token address
     * @return path Best path found (empty array if no path exists)
     */
    function findBestPath(address tokenIn, address tokenOut) 
        external 
        view 
        returns (address[] memory path) 
    {
        require(tokenIn != address(0) && tokenOut != address(0), "Invalid token addresses");
        require(tokenIn != tokenOut, "Identical tokens");
        
        // Check if direct pool exists
        address directPool = factory.getPool(tokenIn, tokenOut);
        if (directPool != address(0)) {
            path = new address[](2);
            path[0] = tokenIn;
            path[1] = tokenOut;
            return path;
        }
        
        // Try via USDC (common base token)
        address USDC = 0x3600000000000000000000000000000000000000; // Arc Testnet USDC
        address pool1 = factory.getPool(tokenIn, USDC);
        address pool2 = factory.getPool(USDC, tokenOut);
        
        if (pool1 != address(0) && pool2 != address(0)) {
            path = new address[](3);
            path[0] = tokenIn;
            path[1] = USDC;
            path[2] = tokenOut;
            return path;
        }
        
        // Return empty array instead of reverting (more frontend-friendly)
        path = new address[](0);
        return path;
    }
}

