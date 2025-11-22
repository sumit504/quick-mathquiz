# Quick Math ⚡

A fast-paced blockchain-based math game built as a Farcaster Mini App with cross-platform wallet support. Answer 4 math questions correctly as quickly as possible, submit your score on-chain, and compete for the top spot on the leaderboard!

## 🎮 Game Overview

Quick Math challenges players to solve simple arithmetic problems under time pressure. Players must catch falling answers before they disappear, competing for the fastest completion time. All scores are stored permanently on the Base blockchain.

### Key Features

- **⏱️ Time-Based Competition**: Race against the clock to solve 4 math questions
- **🎯 Falling Answer Mechanic**: Catch the correct answer before it falls off screen
- **🔗 Dual Blockchain Integration**: Seamless wallet connection via Farcaster or Reown
- **🏆 Global Leaderboard**: Top 50 fastest players displayed with real-time updates
- **💰 Daily Rewards**: Claim ETH rewards once per day upon completion
- **👤 Farcaster Integration**: Display player profiles with avatars and usernames
- **📱 Social Sharing**: Share achievements directly to Farcaster
- **🌐 Standalone Mode**: Play outside Farcaster using Reown wallet connection

## 🛠️ Tech Stack

### Frontend
- **HTML5/CSS3/JavaScript**: Core game interface
- **Farcaster Mini App SDK**: Frame integration and user context
- **Wagmi Core**: Web3 wallet connection and blockchain interactions
- **Reown AppKit**: Universal wallet connection for standalone mode
- **Ethers.js v6**: Ethereum library for smart contract interactions

### Blockchain
- **Network**: Base (Ethereum L2)
- **Smart Contract**: Custom MathDropGame contract
- **Wallet Connectors**: 
  - Farcaster Mini App Connector (in-app)
  - Reown AppKit (standalone mode)

### APIs
- **Neynar API**: Fetch Farcaster user profiles and metadata
- **Reown Project**: Multi-chain wallet connection infrastructure

## 🔌 Wallet Integration

### Farcaster Mode
When accessed as a Farcaster Mini App, the game automatically uses the native Farcaster wallet connector:
- Seamless in-app authentication
- Automatic profile loading (avatar, username, FID)
- Native transaction signing

### Standalone Mode (Reown)
When accessed outside Farcaster, the game uses Reown AppKit for universal wallet support:
- **Supported Wallets**: MetaMask, WalletConnect, Coinbase Wallet, Rainbow, and 300+ others
- **Network**: Automatically configured for Base
- **Features**:
  - Modal-based wallet selection
  - QR code connection for mobile wallets
  - Account switching detection
  - Persistent connection state

### Configuration

```javascript
// Reown Project ID
const REOWN_PROJECT_ID = '******************';

// Reown AppKit initialization
const appKitModal = createAppKit({ 
    adapters: [new EthersAdapter()], 
    projectId: REOWN_PROJECT_ID, 
    networks: [base], 
    metadata: { 
        name: 'Quick Math', 
        description: 'Math game on Base', 
        url: window.location.origin, 
        icons: ['https://quick-mathquiz.vercel.app/image.png'] 
    }
});
```

## 📋 Prerequisites

### For Farcaster Users
- Farcaster account with wallet connected
- Access through Farcaster frame or Mini App

### For Standalone Users
- Compatible Web3 wallet (MetaMask, Coinbase Wallet, etc.)
- Base network support
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
   - `REOWN_PROJECT_ID`: Your Reown project ID (get from https://cloud.reown.com)

### Smart Contract Setup

The game requires a deployed smart contract on Base network with the following functions:

```solidity
- startGame(uint256 farcasterFID)
- submitScore(uint256 completionTime, uint256 farcasterFID, uint256 questionsCorrect)
- claimReward(uint256 farcasterFID, uint256 questionsCorrect)
- getTopPlayers(uint256 count)
- getPlayerStats(address player)
- getRemainingClaimsForFID(uint256 farcasterFID)
- getContractBalance()
- getRewardAmount()
```

## 🎯 How to Play

1. **Connect Wallet**: 
   - In Farcaster: Automatic connection with app wallet
   - Standalone: Click "Connect Wallet" and choose your wallet provider
2. **Start Game**: Click "Start Game" and confirm the blockchain transaction
3. **Answer Questions**: Click the correct falling answer before it disappears
4. **Complete All 4**: Answer all 4 questions correctly to win
5. **Submit Score**: Save your completion time to the on-chain leaderboard
6. **Claim Reward**: Collect your daily ETH reward

## 🏆 Leaderboard System

- Displays top 50 fastest completion times
- Only shows each player's best time
- Real-time updates when new scores are submitted
- Shows player avatars (for Farcaster users), names, and wallet addresses
- Ranks with medals: 🥇 🥈 🥉
- Persistent on-chain storage

## 💎 Reward System

- Complete all 4 questions correctly to be eligible
- Claim ETH reward once per 24 hours per Farcaster ID (or wallet for standalone)
- Rewards sent directly to connected wallet
- Contract balance check ensures prize pool availability
- Smart contract validates claim eligibility

## 🔧 Configuration

### Contract Address
```javascript
const CONTRACT_ADDRESS = '0xadd4fb9ef92b6de07c970d9a1a2ee9f9f175de54';
```

### Neynar API
```javascript
const NEYNAR_API_KEY = '***************';
```

### Reown Project
```javascript
const REOWN_PROJECT_ID = '*****************';
```

### Network Configuration
```javascript
// Wagmi configuration (Farcaster mode)
const wagmiConfig = createConfig({
    chains: [base],
    connectors: [farcasterMiniApp()],
    transports: {
        [base.id]: http()
    }
});

// Reown configuration (Standalone mode)
const appKitModal = createAppKit({
    networks: [base],
    projectId: REOWN_PROJECT_ID
});
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
            "url": "https://quick-mathquiz-tau.vercel.app",
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
- Reown secure connection protocols
- Network verification (Base only)

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

## 🌐 Cross-Platform Compatibility

### Environment Detection
The game automatically detects whether it's running:
- **Inside Farcaster**: Uses native wallet connector and profile data
- **Standalone**: Uses Reown AppKit for wallet connection

### Wallet Provider Handling
```javascript
// Automatic detection
async function detectEnvironment() {
    try {
        const context = await sdk.context;
        if (context?.user?.fid) {
            isFarcasterEnvironment = true;
            // Use Farcaster wallet
        }
    } catch (error) {
        isFarcasterEnvironment = false;
        // Use Reown AppKit
    }
}
```

## 🐛 Known Issues & Limitations

- Requires Base network connectivity
- Audio may not autoplay on some browsers
- Leaderboard limited to top 50 players
- One reward claim per 24 hours per FID
- Reown modal requires user action to connect
- Profile avatars only available for Farcaster users

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

### Development Setup

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License.

## 🔗 Links

- [Live Game](https://quick-mathquiz-tau.vercel.app)
- [Base Network](https://base.org)
- [Farcaster](https://farcaster.xyz)
- [Neynar API](https://neynar.com)
- [Reown](https://reown.com)
- [Smart Contract](https://basescan.org/address/0xadd4fb9ef92b6de07c970d9a1a2ee9f9f175de54)

## 💬 Support

For questions or issues:
- Open an issue on GitHub
- Reach out on Farcaster
- Check the [Reown Documentation](https://docs.reown.com)

## 🙏 Acknowledgments

- Farcaster team for Mini App SDK
- Reown for universal wallet infrastructure
- Base network for low-cost transactions
- Neynar for profile API access

---

Built with ❤️ for the Farcaster community and web3 gamers everywhere