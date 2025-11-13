import { useState } from 'react';
import { getTokenLogoPath } from '../utils/tokenLogos';
import { TOKENS, type TokenSymbol } from '../hooks/useDEX';
import { isAddress, type Address } from 'viem';

export interface TokenLogoProps {
  token: TokenSymbol | string; // Accept both TokenSymbol and string
  size?: number;
  className?: string;
  fallback?: string; // fallback text if image fails to load
  address?: Address | string; // Optional address for custom tokens (for DiceBear)
}

export default function TokenLogo({ token, size = 32, className = '', fallback, address }: TokenLogoProps) {
  const [imageError, setImageError] = useState(false);
  const displaySize = `${size}px`;
  
  // Check if the provided address matches any predefined token
  let matchedPredefinedToken: TokenSymbol | null = null;
  if (address && typeof address === 'string' && isAddress(address)) {
    const addressLower = address.toLowerCase();
    // Check if this address matches any predefined token
    for (const [symbol, tokenInfo] of Object.entries(TOKENS)) {
      if (tokenInfo.address.toLowerCase() === addressLower) {
        matchedPredefinedToken = symbol as TokenSymbol;
        break;
      }
    }
  }
  
  // If address matches a predefined token, use predefined logo
  // Otherwise, if address is provided and doesn't match, use DiceBear
  const isCustomToken = address && typeof address === 'string' && isAddress(address) && !matchedPredefinedToken;
  
  // For custom tokens (address that doesn't match predefined), use DiceBear API
  const diceBearUrl = isCustomToken 
    ? `https://api.dicebear.com/9.x/rings/png?seed=${address}`
    : null;
  
  // For predefined tokens, use the logo path
  // Use matched token symbol if address matched, otherwise use the provided token
  const tokenToUse = matchedPredefinedToken || (typeof token === 'string' ? token.toUpperCase() : token) as TokenSymbol;
  const logoPath = !isCustomToken ? getTokenLogoPath(tokenToUse) : null;
  
  // Fallback text (first letter of token)
  const fallbackText = fallback || (typeof token === 'string' ? token[0] : token[0]);

  // Use DiceBear for custom tokens, or fallback to predefined logos
  const imageSrc = isCustomToken ? diceBearUrl : logoPath;

  if (imageError || !imageSrc) {
    return (
      <div 
        className={`rounded-full bg-orange-500 flex items-center justify-center text-white font-bold ${className}`}
        style={{ width: displaySize, height: displaySize, fontSize: `${size * 0.4}px` }}
      >
        {fallbackText}
      </div>
    );
  }

  return (
    <div 
      className={`rounded-full overflow-hidden bg-gray-100 flex items-center justify-center ${className}`}
      style={{ width: displaySize, height: displaySize }}
    >
      <img
        src={imageSrc}
        alt={token}
        className="w-full h-full object-cover"
        onError={() => setImageError(true)}
      />
    </div>
  );
}

