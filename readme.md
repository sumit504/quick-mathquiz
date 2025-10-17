# Quick Math ⚡

A fast-paced blockchain-based math game built as a Farcaster Mini App. Answer 4 math questions correctly as quickly as possible, submit your score on-chain, and compete for the top spot on the leaderboard!

## 🎮 Game Overview

Quick Math challenges players to solve simple arithmetic problems under time pressure. Players must catch falling answers before they disappear, competing for the fastest completion time. All scores are stored permanently on the Base blockchain.

### Key Features

- **⏱️ Time-Based Competition**: Race against the clock to solve 4 math questions
- **🎯 Falling Answer Mechanic**: Catch the correct answer before it falls off screen
- **🔗 Blockchain Integration**: Scores and rewards stored on Base network
- **🏆 Global Leaderboard**: Top 50 fastest players displayed with real-time updates
- **💰 Daily Rewards**: Claim ETH rewards once per day upon completion
- **👤 Farcaster Integration**: Display player profiles with avatars and usernames
- **📱 Social Sharing**: Share achievements directly to Farcaster

## 🛠️ Tech Stack

### Frontend
- **HTML5/CSS3/JavaScript**: Core game interface
- **Farcaster Mini App SDK**: Frame integration and user context
- **Wagmi Core**: Web3 wallet connection and blockchain interactions

### Blockchain
- **Network**: Base (Ethereum L2)
- **Smart Contract**: Custom MathDropGame contract
- **Wallet**: Farcaster Mini App Connector

### APIs
- **Neynar API**: Fetch Farcaster user profiles and metadata

## 📋 Prerequisites

- Farcaster account
- Compatible wallet for Base network
- Modern web browser with JavaScript enabled

## 🚀 Getting Started

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/quick-math.git
cd quick-math
```

2. Deploy to your web server or hosting platform:
```bash
# Example with Vercel
vercel deploy
```

3. Update the following in `index.html`:
   - `CONTRACT_ADDRESS`: Your deployed smart contract address
   - `NEYNAR_API_KEY`: Your Neynar API key

### Smart Contract Setup

The game requires a deployed smart contract on Base network with the following functions:

```solidity
- startGame(uint256 farcasterFID)
- submitScore(uint256 completionTime, uint256 farcasterFID, uint256 questionsCorrect)
- claimReward(uint256 farcasterFID, uint256 questionsCorrect)
- getTopPlayers(uint256 count)
- getPlayerStats(address player)
- getRemainingClaimsForFID(uint256 farcasterFID)
```

## 🎯 How to Play

1. **Connect Wallet**: Click "Connect Wallet" to authenticate with your Base wallet
2. **Start Game**: Click "Start Game" and confirm the blockchain transaction
3. **Answer Questions**: Click the correct falling answer before it disappears
4. **Complete All 4**: Answer all 4 questions correctly to win
5. **Submit Score**: Save your completion time to the on-chain leaderboard
6. **Claim Reward**: Collect your daily ETH reward

## 🏆 Leaderboard System

- Displays top 50 fastest completion times
- Only shows each player's best time
- Real-time updates when new scores are submitted
- Shows player avatars, names, and wallet addresses
- Ranks with medals: 🥇 🥈 🥉

## 💎 Reward System

- Complete all 4 questions correctly to be eligible
- Claim ETH reward once per 24 hours per Farcaster ID
- Rewards sent directly to connected wallet
- Contract balance check ensures prize pool availability

## 🔧 Configuration

### Contract Address
```javascript
const CONTRACT_ADDRESS = '0xadd4fb9ef92b6de07c970d9a1a2ee9f9f175de54';
```

### Neynar API
```javascript
const NEYNAR_API_KEY = 'YOUR_API_KEY_HERE';
```

### Network Configuration
```javascript
chains: [base]
transports: {
    [base.id]: http()
}
```

## 📱 Farcaster Frame Configuration

The game includes Farcaster Mini App metadata:

```json
{
    "version": "1",
    "imageUrl": "https://quick-mathquiz.vercel.app/image.png",
    "button": {
        "title": "Play Quick Math & Earn!",
        "action": {
            "type": "launch_frame",
            "name": "Quick Math",
            "url": "https://quick-mathquiz.vercel.app",
            "splashImageUrl": "https://quick-mathquiz.vercel.app/splash.png",
            "splashBackgroundColor": "#cce5ff"
        }
    }
}
```

## 🎨 Game Mechanics

### Question Types
- Addition: `a + b`
- Subtraction: `a - b` (always positive results)
- Multiplication: `a × b`

### Answer Generation
- One correct answer
- Three incorrect but plausible distractors
- Randomized positions for each question
- 6-second falling animation

### Scoring
- Time starts on first question load
- Stops when 4th question answered correctly
- Time displayed in seconds with 2 decimal places
- Only best times saved to leaderboard

## 🔐 Security Features

- Transaction confirmations required for all blockchain actions
- User rejection handling for wallet transactions
- Score validation on smart contract
- Daily claim limits per Farcaster ID
- Balance checks before reward distribution

## 🎵 Audio Assets

Required audio files in `/sounds/` directory:
- `correct.mp3`: Played on correct answer
- `wrong.mp3`: Played on incorrect answer
- `win.mp3`: Played on game completion

## 📊 Player Statistics

The contract tracks:
- Best completion time
- Total games played
- Total rewards claimed
- Last play timestamp

## 🐛 Known Issues & Limitations

- Requires Base network connectivity
- Audio may not autoplay on some browsers
- Leaderboard limited to top 50 players
- One reward claim per 24 hours per FID

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License.

## 🔗 Links

- [Live Game](https://quick-mathquiz.vercel.app)
- [Base Network](https://base.org)
- [Farcaster](https://farcaster.xyz)
- [Neynar API](https://neynar.com)

## 💬 Support

For questions or issues, please open an issue on GitHub or reach out on Farcaster.

---

Built with ❤️ for the Farcaster community