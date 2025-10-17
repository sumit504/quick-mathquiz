// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title MathDropGame - FINAL VERSION WITH START GAME TRANSACTION
 * @dev Only winners (4/4 correct) can submit scores and claim rewards
 * @dev Players must confirm transaction to start game
 * @dev Shows best time per player on leaderboard, prevents spam submissions
 */
contract MathDropGame {
    
    // ============ Structs ============
    
    struct LeaderboardEntry {
        address player;
        uint256 farcasterFID;
        uint256 completionTime;
        uint256 timestamp;
    }
    
    struct PlayerStats {
        uint256 bestTime;
        uint256 totalGames;
        uint256 totalRewardsClaimed;
        uint256 lastPlayTimestamp;
    }
    
    // ============ State Variables ============
    
    LeaderboardEntry[] public leaderboard;
    
    mapping(address => PlayerStats) public playerStats;
    mapping(uint256 => mapping(uint256 => uint256)) public fidDailyClaims;
    
    address public immutable owner;
    uint256 public constant REWARD_AMOUNT = 8510638297872;  // ~$0.04 at $4700 ETH
    uint256 public constant MAX_DAILY_CLAIMS_PER_FID = 1;
    uint256 public constant REQUIRED_CORRECT_ANSWERS = 4;
    
    // ============ Events ============
    
    event GameStarted(
        address indexed player,
        uint256 indexed farcasterFID,
        uint256 timestamp
    );
    
    event ScoreSubmitted(
        address indexed player,
        uint256 indexed farcasterFID,
        uint256 completionTime,
        uint256 leaderboardPosition,
        bool isNewBest
    );
    
    event RewardClaimed(
        address indexed player,
        uint256 indexed farcasterFID,
        uint256 amount
    );
    
    event ContractFunded(address indexed funder, uint256 amount);
    
    // ============ Errors ============
    
    error OnlyOwner();
    error InsufficientBalance();
    error InvalidCompletionTime();
    error TransferFailed();
    error ExceededDailyClaims();
    error ScoreNotBetter();
    error MustCompleteFourQuestions();
    
    // ============ Constructor ============
    
    constructor() payable {
        owner = msg.sender;
        if (msg.value > 0) {
            emit ContractFunded(msg.sender, msg.value);
        }
    }
    
    // ============ Modifiers ============
    
    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }
    
    // ============ Receive Function ============
    
    receive() external payable {
        emit ContractFunded(msg.sender, msg.value);
    }
    
    // ============ Core Game Functions ============
    
    /**
     * @dev Player must call this to start a game (creates on-chain record)
     * @param farcasterFID Player's Farcaster FID
     */
    function startGame(uint256 farcasterFID) external {
        emit GameStarted(msg.sender, farcasterFID, block.timestamp);
    }
    
    /**
     * @dev Submit score - ONLY if player got 4/4 correct AND better than previous best
     * @param completionTime Time in milliseconds
     * @param farcasterFID Player's Farcaster FID
     * @param questionsCorrect Number of questions answered correctly (must be 4)
     * @return position Leaderboard position
     */
    function submitScore(
        uint256 completionTime,
        uint256 farcasterFID,
        uint256 questionsCorrect
    ) external returns (uint256 position) {
        // Must complete all 4 questions correctly
        if (questionsCorrect != REQUIRED_CORRECT_ANSWERS) {
            revert MustCompleteFourQuestions();
        }
        
        // Validate time (between 1 second and 10 minutes)
        if (completionTime == 0 || completionTime > 600000) {
            revert InvalidCompletionTime();
        }
        
        PlayerStats storage stats = playerStats[msg.sender];
        
        // Check if this score is better than previous best
        if (stats.bestTime > 0 && completionTime >= stats.bestTime) {
            revert ScoreNotBetter();
        }
        
        bool isNewBest = stats.bestTime > 0;
        
        // Update best time
        stats.bestTime = completionTime;
        stats.totalGames++;
        stats.lastPlayTimestamp = block.timestamp;
        
        // Create new entry
        LeaderboardEntry memory newEntry = LeaderboardEntry({
            player: msg.sender,
            farcasterFID: farcasterFID,
            completionTime: completionTime,
            timestamp: block.timestamp
        });
        
        leaderboard.push(newEntry);
        position = leaderboard.length - 1;
        
        emit ScoreSubmitted(msg.sender, farcasterFID, completionTime, position, isNewBest);
        
        return position;
    }
    
    /**
     * @dev Claim reward after winning - ONLY if player got 4/4 correct
     * @param farcasterFID Player's Farcaster FID
     * @param questionsCorrect Number of questions answered correctly (must be 4)
     */
    function claimReward(uint256 farcasterFID, uint256 questionsCorrect) external {
        // Must have completed all 4 questions correctly to claim
        if (questionsCorrect != REQUIRED_CORRECT_ANSWERS) {
            revert MustCompleteFourQuestions();
        }
        
        uint256 today = block.timestamp / 1 days;
        
        if (fidDailyClaims[farcasterFID][today] >= MAX_DAILY_CLAIMS_PER_FID) {
            revert ExceededDailyClaims();
        }
        
        if (address(this).balance < REWARD_AMOUNT) revert InsufficientBalance();
        
        fidDailyClaims[farcasterFID][today]++;
        playerStats[msg.sender].totalRewardsClaimed += REWARD_AMOUNT;
        
        (bool success, ) = payable(msg.sender).call{value: REWARD_AMOUNT}("");
        if (!success) revert TransferFailed();
        
        emit RewardClaimed(msg.sender, farcasterFID, REWARD_AMOUNT);
    }
    
    // ============ View Functions ============
    
    /**
     * @dev Get top N players with UNIQUE addresses (best time only)
     * @param count Number of top players to return
     * @return topPlayers Array of best entries per player
     */
    function getTopPlayers(uint256 count) external view returns (LeaderboardEntry[] memory topPlayers) {
        uint256 totalEntries = leaderboard.length;
        if (totalEntries == 0) {
            return new LeaderboardEntry[](0);
        }
        
        // Create array to track best time per address
        address[] memory uniqueAddresses = new address[](totalEntries);
        uint256[] memory bestTimes = new uint256[](totalEntries);
        uint256 uniqueCount = 0;
        
        // Find best time for each unique address
        for (uint256 i = 0; i < totalEntries; i++) {
            address player = leaderboard[i].player;
            uint256 time = leaderboard[i].completionTime;
            
            bool found = false;
            for (uint256 j = 0; j < uniqueCount; j++) {
                if (uniqueAddresses[j] == player) {
                    if (time < bestTimes[j]) {
                        bestTimes[j] = time;
                    }
                    found = true;
                    break;
                }
            }
            
            if (!found) {
                uniqueAddresses[uniqueCount] = player;
                bestTimes[uniqueCount] = time;
                uniqueCount++;
            }
        }
        
        // Create sorted result with full entry data
        LeaderboardEntry[] memory sortedEntries = new LeaderboardEntry[](uniqueCount);
        
        for (uint256 i = 0; i < uniqueCount; i++) {
            // Find the entry with best time for this address
            for (uint256 j = 0; j < totalEntries; j++) {
                if (leaderboard[j].player == uniqueAddresses[i] && 
                    leaderboard[j].completionTime == bestTimes[i]) {
                    sortedEntries[i] = leaderboard[j];
                    break;
                }
            }
        }
        
        // Bubble sort by completion time
        for (uint256 i = 0; i < uniqueCount - 1; i++) {
            for (uint256 j = 0; j < uniqueCount - i - 1; j++) {
                if (sortedEntries[j].completionTime > sortedEntries[j + 1].completionTime) {
                    LeaderboardEntry memory temp = sortedEntries[j];
                    sortedEntries[j] = sortedEntries[j + 1];
                    sortedEntries[j + 1] = temp;
                }
            }
        }
        
        // Return top N
        uint256 returnCount = count > uniqueCount ? uniqueCount : count;
        topPlayers = new LeaderboardEntry[](returnCount);
        
        for (uint256 i = 0; i < returnCount; i++) {
            topPlayers[i] = sortedEntries[i];
        }
        
        return topPlayers;
    }
    
    /**
     * @dev Get player statistics
     * @param player Player address
     * @return bestTime Best completion time in milliseconds
     * @return totalGames Total number of games played
     * @return totalRewardsClaimed Total rewards claimed in wei
     * @return lastPlayTimestamp Timestamp of last game played
     */
    function getPlayerStats(address player) external view returns (
        uint256 bestTime,
        uint256 totalGames,
        uint256 totalRewardsClaimed,
        uint256 lastPlayTimestamp
    ) {
        PlayerStats memory stats = playerStats[player];
        return (
            stats.bestTime,
            stats.totalGames,
            stats.totalRewardsClaimed,
            stats.lastPlayTimestamp
        );
    }
    
    /**
     * @dev Get remaining claims for FID today
     * @param farcasterFID The Farcaster FID to check
     * @return remaining Number of claims remaining today
     */
    function getRemainingClaimsForFID(uint256 farcasterFID) external view returns (uint256 remaining) {
        uint256 today = block.timestamp / 1 days;
        uint256 claimedToday = fidDailyClaims[farcasterFID][today];
        
        if (claimedToday >= MAX_DAILY_CLAIMS_PER_FID) {
            return 0;
        }
        
        return MAX_DAILY_CLAIMS_PER_FID - claimedToday;
    }
    
    /**
     * @dev Get total number of scores submitted
     * @return size Total entries in leaderboard
     */
    function getLeaderboardSize() external view returns (uint256 size) {
        return leaderboard.length;
    }
    
    /**
     * @dev Get contract ETH balance
     * @return balance Contract balance in wei
     */
    function getContractBalance() external view returns (uint256 balance) {
        return address(this).balance;
    }
    
    /**
     * @dev Get reward amount (for frontend display)
     * @return amount Reward amount in wei
     */
    function getRewardAmount() external pure returns (uint256 amount) {
        return REWARD_AMOUNT;
    }
    
    /**
     * @dev Get total claims made by a specific FID today
     * @param farcasterFID Farcaster user ID
     * @return claims Number of claims made today
     */
    function getTotalClaimsByFID(uint256 farcasterFID) external view returns (uint256 claims) {
        uint256 today = block.timestamp / 1 days;
        return fidDailyClaims[farcasterFID][today];
    }
    
    /**
     * @dev Get required correct answers constant
     * @return required Number of required correct answers (always 4)
     */
    function getRequiredCorrectAnswers() external pure returns (uint256 required) {
        return REQUIRED_CORRECT_ANSWERS;
    }
    
    // ============ Owner Functions ============
    
    /**
     * @dev Fund the contract with ETH for rewards
     */
    function fundContract() external payable onlyOwner {
        emit ContractFunded(msg.sender, msg.value);
    }
    
    /**
     * @dev Withdraw specific amount of ETH
     * @param amount Amount to withdraw in wei
     */
    function withdrawETH(uint256 amount) external onlyOwner {
        if (amount > address(this).balance) revert InsufficientBalance();
        
        (bool success, ) = payable(owner).call{value: amount}("");
        if (!success) revert TransferFailed();
    }
    
    /**
     * @dev Emergency withdraw all funds
     */
    function emergencyWithdrawAll() external onlyOwner {
        uint256 balance = address(this).balance;
        if (balance == 0) revert InsufficientBalance();
        
        (bool success, ) = payable(owner).call{value: balance}("");
        if (!success) revert TransferFailed();
    }
}