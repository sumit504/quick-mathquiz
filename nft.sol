// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

contract QuickMathNFT is ERC721, Ownable {
    using Strings for uint256;
    
    uint256 private _currentTokenId = 0;
    uint256 public constant MAX_SUPPLY = 999;
    uint256 public constant MAX_PER_WALLET = 2;
    string private _baseTokenURI;
    
    // Track mints per wallet
    mapping(address => uint256) public mintedPerWallet;
    
    // Events
    event Minted(address indexed to, uint256 indexed tokenId, uint256 quantity);
    
    constructor() ERC721("Quick Math NFT", "QMATH") Ownable(msg.sender) {
        // Set your base URI - update this to your IPFS metadata location
        _baseTokenURI = "ipfs://bafybeif4e4742ninmtqeirgv3nzac32xkinamrl6uuahhq66dxn5bfvou4/";
    }
    
    /**
     * @dev Free mint function - up to 2 per wallet
     */
    function mint(uint256 quantity) external {
        require(quantity > 0 && quantity <= 2, "Quantity must be 1 or 2");
        require(_currentTokenId + quantity <= MAX_SUPPLY, "Would exceed max supply");
        require(mintedPerWallet[msg.sender] + quantity <= MAX_PER_WALLET, "Would exceed wallet limit (2 max)");
        
        mintedPerWallet[msg.sender] += quantity;
        
        for (uint256 i = 0; i < quantity; i++) {
            _currentTokenId++;
            _safeMint(msg.sender, _currentTokenId);
        }
        
        emit Minted(msg.sender, _currentTokenId - quantity + 1, quantity);
    }
    
    /**
     * @dev Owner mint for giveaways/team
     */
    function ownerMint(address to, uint256 quantity) external onlyOwner {
        require(quantity <= 10, "Max 10 per batch");
        require(_currentTokenId + quantity <= MAX_SUPPLY, "Would exceed max supply");
        
        for (uint256 i = 0; i < quantity; i++) {
            _currentTokenId++;
            _safeMint(to, _currentTokenId);
        }
        
        emit Minted(to, _currentTokenId - quantity + 1, quantity);
    }
    
    /**
     * @dev Returns total supply
     */
    function totalSupply() external view returns (uint256) {
        return _currentTokenId;
    }
    
    /**
     * @dev Returns token URI
     */
    function tokenURI(uint256 tokenId) public view virtual override returns (string memory) {
        require(_ownerOf(tokenId) != address(0), "URI query for nonexistent token");
        return string(abi.encodePacked(_baseTokenURI, tokenId.toString(), ".json"));
    }
    
    /**
     * @dev Get remaining mints for a wallet
     */
    function getRemainingMints(address wallet) external view returns (uint256) {
        if (mintedPerWallet[wallet] >= MAX_PER_WALLET) {
            return 0;
        }
        return MAX_PER_WALLET - mintedPerWallet[wallet];
    }
    
    /**
     * @dev Update base URI (only owner)
     */
    function setBaseTokenURI(string memory newBaseTokenURI) external onlyOwner {
        _baseTokenURI = newBaseTokenURI;
    }
    
    /**
     * @dev Get base URI
     */
    function baseTokenURI() external view returns (string memory) {
        return _baseTokenURI;
    }
    
    /**
     * @dev Check if max supply reached
     */
    function isMaxSupplyReached() external view returns (bool) {
        return _currentTokenId >= MAX_SUPPLY;
    }
    
    /**
     * @dev Withdraw any ETH
     */
    function withdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No funds to withdraw");
        
        (bool success, ) = payable(owner()).call{value: balance}("");
        require(success, "Withdrawal failed");
    }
}