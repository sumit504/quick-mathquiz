// Buffer polyfill for wallet connections
import { Buffer } from 'buffer';
window.Buffer = Buffer;
window.global = window.global || window;
window.process = window.process || { env: {} };

import { sdk } from '@farcaster/miniapp-sdk';
import { createAppKit } from '@reown/appkit';
import { EthersAdapter } from '@reown/appkit-adapter-ethers';
import { base } from '@reown/appkit/networks';
import { ethers } from 'ethers';
import { createConfig, connect, writeContract, readContract, getAccount, waitForTransactionReceipt, watchAccount, http } from '@wagmi/core';
import { base as wagmiBase } from '@wagmi/core/chains';
import { farcasterMiniApp } from '@farcaster/miniapp-wagmi-connector';

// Global Variables
let isFarcasterEnvironment = false;
let userProfile = null;
let farcasterFID = null;
let appKitModal = null;
let ethersProvider = null;

window.walletConfig = null;
window.isWalletConnected = false;
window.currentAccount = null;

// Contract Addresses
const CONTRACT_ADDRESS = '0xadd4fb9ef92b6de07c970d9a1a2ee9f9f175de54';
const NFT_CONTRACT_ADDRESS = '0x6dffddc1e0b01b124047c5e7aefc3f87e6f77beb';

// API Keys
const NEYNAR_API_KEY = '8BF81B8C-C491-4735-8E1C-FC491FF048D4';
const REOWN_PROJECT_ID = 'e0dd881bad824ac3418617434a79f917';

// Contract ABIs
const CONTRACT_ABI = [
    {"inputs":[{"internalType":"uint256","name":"farcasterFID","type":"uint256"}],"name":"startGame","outputs":[],"stateMutability":"nonpayable","type":"function"},
    {"inputs":[{"internalType":"uint256","name":"completionTime","type":"uint256"},{"internalType":"uint256","name":"farcasterFID","type":"uint256"},{"internalType":"uint256","name":"questionsCorrect","type":"uint256"}],"name":"submitScore","outputs":[{"internalType":"uint256","name":"position","type":"uint256"}],"stateMutability":"nonpayable","type":"function"},
    {"inputs":[{"internalType":"uint256","name":"farcasterFID","type":"uint256"},{"internalType":"uint256","name":"questionsCorrect","type":"uint256"}],"name":"claimReward","outputs":[],"stateMutability":"nonpayable","type":"function"},
    {"inputs":[{"internalType":"uint256","name":"count","type":"uint256"}],"name":"getTopPlayers","outputs":[{"components":[{"internalType":"address","name":"player","type":"address"},{"internalType":"uint256","name":"farcasterFID","type":"uint256"},{"internalType":"uint256","name":"completionTime","type":"uint256"},{"internalType":"uint256","name":"timestamp","type":"uint256"}],"internalType":"struct MathDropGame.LeaderboardEntry[]","name":"","type":"tuple[]"}],"stateMutability":"view","type":"function"},
    {"inputs":[{"internalType":"address","name":"player","type":"address"}],"name":"getPlayerStats","outputs":[{"internalType":"uint256","name":"bestTime","type":"uint256"},{"internalType":"uint256","name":"totalGames","type":"uint256"},{"internalType":"uint256","name":"totalRewardsClaimed","type":"uint256"},{"internalType":"uint256","name":"lastPlayTimestamp","type":"uint256"}],"stateMutability":"view","type":"function"},
    {"inputs":[{"internalType":"uint256","name":"farcasterFID","type":"uint256"}],"name":"getRemainingClaimsForFID","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
    {"inputs":[],"name":"getContractBalance","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
    {"inputs":[],"name":"getRewardAmount","outputs":[{"internalType":"uint256","name":"amount","type":"uint256"}],"stateMutability":"pure","type":"function"}
];

const NFT_CONTRACT_ABI = [
    {"inputs":[{"internalType":"uint256","name":"quantity","type":"uint256"}],"name":"mint","outputs":[],"stateMutability":"nonpayable","type":"function"},
    {"inputs":[],"name":"totalSupply","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
    {"inputs":[{"internalType":"address","name":"wallet","type":"address"}],"name":"getRemainingMints","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
    {"inputs":[],"name":"remainingSupply","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"}
];

// Environment Detection
async function detectEnvironment() {
    try {
        const context = await sdk.context;
        if (context?.user?.fid) {
            isFarcasterEnvironment = true;
            console.log('✅ Farcaster Environment Detected');
            return true;
        }
    } catch (error) {
        console.log('Not in Farcaster environment');
    }
    
    isFarcasterEnvironment = false;
    console.log('🌐 Standalone Mode - Using Reown');
    return false;
}

// Fetch Farcaster Profile
async function fetchFarcasterProfile() {
    try {
        const context = await sdk.context;
        if (context?.user?.fid) {
            farcasterFID = context.user.fid;
            const response = await fetch(
                `https://api.neynar.com/v2/farcaster/user/bulk?fids=${farcasterFID}`,
                {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json',
                        'api_key': NEYNAR_API_KEY
                    }
                }
            );
            
            if (response.ok) {
                const data = await response.json();
                if (data.users && data.users.length > 0) {
                    userProfile = data.users[0];
                    updateProfileUI();
                }
            }
        } else {
            // Demo mode
            userProfile = {
                display_name: "Demo Player",
                username: "player",
                pfp_url: null
            };
            farcasterFID = 0;
            updateProfileUI();
        }
    } catch (error) {
        console.error('Failed to fetch profile:', error);
        userProfile = {
            display_name: "Demo Player",
            username: "player",
            pfp_url: null
        };
        farcasterFID = 0;
        updateProfileUI();
    }
}

function updateProfileUI() {
    if (!userProfile) return;
    
    const headerAvatar = document.getElementById('headerAvatar');
    if (userProfile.pfp_url) {
        headerAvatar.innerHTML = `<img src="${userProfile.pfp_url}" alt="Avatar">`;
    } else {
        headerAvatar.textContent = userProfile.display_name ? 
            userProfile.display_name.charAt(0).toUpperCase() : '?';
    }
    headerAvatar.classList.add('show');
}

// Initialize Farcaster Wallet
async function initializeFarcasterWallet() {
    try {
        window.walletConfig = createConfig({
            chains: [wagmiBase],
            connectors: [farcasterMiniApp()],
            transports: {
                [wagmiBase.id]: http()
            }
        });
        
        watchAccount(window.walletConfig, {
            onChange: (account) => updateWalletUI(account)
        });
        
        const account = getAccount(window.walletConfig);
        if (account.isConnected) {
            updateWalletUI(account);
        } else {
            try {
                await connect(window.walletConfig, {
                    connector: farcasterMiniApp()
                });
                updateWalletUI(getAccount(window.walletConfig));
            } catch (error) {
                console.log('Auto-connect failed:', error);
                updateWalletUI(getAccount(window.walletConfig));
            }
        }
    } catch (error) {
        console.error('Failed to initialize Farcaster wallet:', error);
    }
}

// Initialize Reown Wallet
async function initializeReownWallet() {
    try {
        const adapter = new EthersAdapter();
        appKitModal = createAppKit({
            adapters: [adapter],
            projectId: REOWN_PROJECT_ID,
            networks: [base],
            metadata: {
                name: 'Quick Math',
                description: 'Math game on Base',
                url: window.location.origin,
                icons: ['https://quick-mathquiz.vercel.app/image.png']
            },
            features: {
                analytics: false
            }
        });

        const unsubscribe = appKitModal.subscribeState((state) => {
            if (state.open === false && !state.loading) {
                setTimeout(() => checkConnection(), 500);
            }
        });

        async function checkConnection() {
            try {
                const walletProvider = appKitModal.getWalletProvider();
                if (walletProvider) {
                    ethersProvider = new ethers.BrowserProvider(walletProvider);
                    const signer = await ethersProvider.getSigner();
                    const address = await signer.getAddress();
                    
                    if (address) {
                        window.currentAccount = { address: address, isConnected: true };
                        window.isWalletConnected = true;
                        updateWalletUI({ isConnected: true, address: address });
                        return true;
                    }
                }
            } catch (error) {
                console.log('Connection check failed:', error);
            }
            
            window.currentAccount = null;
            window.isWalletConnected = false;
            ethersProvider = null;
            updateWalletUI({ isConnected: false });
            return false;
        }

        setTimeout(() => checkConnection(), 1000);
    } catch (error) {
        console.error('Failed to initialize Reown:', error);
    }
}

function updateWalletUI(account) {
    if (account && account.isConnected && account.address) {
        window.isWalletConnected = true;
        window.currentAccount = account;
        
        document.getElementById('walletIndicator').classList.add('connected');
        document.getElementById('walletStatus').textContent = 'Connected';
        document.getElementById('walletInfo').style.display = 'block';
        document.getElementById('walletAddress').textContent = 
            `${account.address.slice(0, 6)}...${account.address.slice(-4)}`;
        document.getElementById('connectBtn').style.display = 'none';
        document.getElementById('playBtn').disabled = false;
    } else {
        window.isWalletConnected = false;
        window.currentAccount = null;
        
        document.getElementById('walletIndicator').classList.remove('connected');
        document.getElementById('walletStatus').textContent = 'Not Connected';
        document.getElementById('walletInfo').style.display = 'none';
        document.getElementById('connectBtn').style.display = 'inline-block';
        document.getElementById('playBtn').disabled = true;
    }
}

// Export user profile getter
window.userProfile = userProfile;
window.getFarcasterFID = () => farcasterFID;

// Connect Wallet Function
window.connectWallet = async function() {
    try {
        if (isFarcasterEnvironment) {
            await connect(window.walletConfig, {
                connector: farcasterMiniApp()
            });
            updateWalletUI(getAccount(window.walletConfig));
        } else {
            await appKitModal.open();
            
            const checkInterval = setInterval(async () => {
                const state = appKitModal.getState();
                
                if (state.open === false && !state.loading) {
                    clearInterval(checkInterval);
                    
                    try {
                        const walletProvider = appKitModal.getWalletProvider();
                        if (walletProvider) {
                            ethersProvider = new ethers.BrowserProvider(walletProvider);
                            const signer = await ethersProvider.getSigner();
                            const address = await signer.getAddress();
                            
                            if (address) {
                                window.currentAccount = { address: address, isConnected: true };
                                window.isWalletConnected = true;
                                updateWalletUI({ isConnected: true, address: address });
                            }
                        }
                    } catch (error) {
                        console.log('Failed to get wallet info:', error);
                    }
                }
            }, 500);
            
            setTimeout(() => clearInterval(checkInterval), 10000);
        }
    } catch (error) {
        console.error('Connection error:', error);
        showSuccessMessage('❌ Failed to connect wallet');
    }
};

// Game Functions
window.startGame = async function() {
    if (!window.isWalletConnected) {
        alert('Please connect your wallet first!');
        return;
    }
    
    try {
        const playBtn = document.getElementById('playBtn');
        playBtn.disabled = true;
        playBtn.innerHTML = 'Confirming... <div class="loading-spinner" style="display: inline-block; width: 16px; height: 16px;"></div>';
        
        const fid = window.getFarcasterFID();
        
        if (isFarcasterEnvironment) {
            const hash = await writeContract(window.walletConfig, {
                address: CONTRACT_ADDRESS,
                abi: CONTRACT_ABI,
                functionName: 'startGame',
                args: [BigInt(fid || 0)]
            });
            
            const receipt = await waitForTransactionReceipt(window.walletConfig, { hash });
            if (receipt.status !== 'success') {
                throw new Error('Transaction failed');
            }
        } else {
            if (!ethersProvider) {
                const walletProvider = appKitModal.getWalletProvider();
                if (walletProvider) {
                    ethersProvider = new ethers.BrowserProvider(walletProvider);
                } else {
                    throw new Error('No wallet provider available');
                }
            }
            
            const signer = await ethersProvider.getSigner();
            const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
            const tx = await contract.startGame(0);
            await tx.wait();
        }
        
        // Initialize game state
        window.gameState = 'playing';
        window.currentQuestion = 0;
        window.correctAnswers = [false, false, false, false];
        window.totalCorrectAnswers = 0;
        
        // Show game screen
        document.getElementById('startScreen').classList.add('hidden');
        document.getElementById('gameScreen').classList.remove('hidden');
        document.getElementById('timerDisplay').classList.remove('hidden');
        
        window.updateProgressBoxes();
        window.updateQuestionNumber();
        
        // Start timer
        window.gameStartTime = Date.now();
        window.currentGameTime = 0;
        window.timerInterval = setInterval(() => {
            window.currentGameTime = Date.now() - window.gameStartTime;
            document.getElementById('timer').textContent = window.formatTime(window.currentGameTime);
        }, 100);
        
        window.generateQuestion();
    } catch (error) {
        console.error('Start game error:', error);
        const playBtn = document.getElementById('playBtn');
        playBtn.disabled = false;
        playBtn.textContent = 'Start Game';
        showSuccessMessage('❌ Failed to start game');
    }
};

window.submitScoreOnChain = async function() {
    if (!window.isWalletConnected || !window.currentAccount) {
        showSuccessMessage('🔗 Please connect your wallet first!');
        return;
    }
    
    if (window.totalCorrectAnswers !== 4) {
        showSuccessMessage('❌ Must complete all 4 questions correctly!');
        return;
    }
    
    const fid = window.getFarcasterFID();
    
    try {
        let playerStats;
        if (isFarcasterEnvironment) {
            playerStats = await readContract(window.walletConfig, {
                address: CONTRACT_ADDRESS,
                abi: CONTRACT_ABI,
                functionName: 'getPlayerStats',
                args: [window.currentAccount.address]
            });
        } else {
            if (!ethersProvider) {
                const walletProvider = appKitModal.getWalletProvider();
                if (walletProvider) {
                    ethersProvider = new ethers.BrowserProvider(walletProvider);
                }
            }
            const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, ethersProvider);
            playerStats = await contract.getPlayerStats(window.currentAccount.address);
        }
        
        const previousBestTime = Number(playerStats[0]);
        
        showSuccessMessage('⏳ Submitting score onchain...');
        
        if (isFarcasterEnvironment) {
            const hash = await writeContract(window.walletConfig, {
                address: CONTRACT_ADDRESS,
                abi: CONTRACT_ABI,
                functionName: 'submitScore',
                args: [BigInt(window.currentGameTime), BigInt(fid || 0), BigInt(window.totalCorrectAnswers)]
            });
            
            const receipt = await waitForTransactionReceipt(window.walletConfig, { hash });
            if (receipt.status !== 'success') {
                throw new Error('Transaction failed');
            }
        } else {
            const signer = await ethersProvider.getSigner();
            const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
            const tx = await contract.submitScore(window.currentGameTime, 0, window.totalCorrectAnswers);
            await tx.wait();
        }
        
        // Fetch rank
        try {
            const topPlayers = isFarcasterEnvironment ?
                await readContract(window.walletConfig, {
                    address: CONTRACT_ADDRESS,
                    abi: CONTRACT_ABI,
                    functionName: 'getTopPlayers',
                    args: [BigInt(50)]
                }) :
                await (new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, ethersProvider)).getTopPlayers(50);
            
            const bestTimesMap = new Map();
            topPlayers.forEach(entry => {
                const address = entry.player.toLowerCase();
                if (!bestTimesMap.has(address) || Number(entry.completionTime) < Number(bestTimesMap.get(address).completionTime)) {
                    bestTimesMap.set(address, entry);
                }
            });
            
            const uniquePlayers = Array.from(bestTimesMap.values())
                .sort((a, b) => Number(a.completionTime) - Number(b.completionTime));
            
            const playerAddress = window.currentAccount.address.toLowerCase();
            const rankIndex = uniquePlayers.findIndex(p => p.player.toLowerCase() === playerAddress);
            
            if (rankIndex !== -1) {
                window.playerRank = rankIndex + 1;
            }
        } catch (error) {
            console.log('Could not fetch rank:', error);
        }
        
        showSuccessMessage(previousBestTime === 0 ? '🎉 First score submitted!' : '🎉 New best time!');
        
        if (!document.getElementById('leaderboardScreen').classList.contains('hidden')) {
            await window.loadOnChainLeaderboard();
        }
    } catch (error) {
        console.error('Submit score error:', error);
        showSuccessMessage('❌ Failed to submit score');
    }
};

window.claimRewardOnChain = async function() {
    if (!window.isWalletConnected || !window.currentAccount) {
        showSuccessMessage('🔗 Please connect your wallet first!');
        return;
    }
    
    if (window.totalCorrectAnswers !== 4) {
        showSuccessMessage('❌ Must complete all 4 questions correctly!');
        return;
    }
    
    const fid = window.getFarcasterFID();
    
    try {
        showSuccessMessage('⏳ Checking eligibility...');
        
        let remainingClaims, rewardAmount, contractBalance;
        
        if (isFarcasterEnvironment) {
            remainingClaims = await readContract(window.walletConfig, {
                address: CONTRACT_ADDRESS,
                abi: CONTRACT_ABI,
                functionName: 'getRemainingClaimsForFID',
                args: [BigInt(fid || 0)]
            });
            rewardAmount = await readContract(window.walletConfig, {
                address: CONTRACT_ADDRESS,
                abi: CONTRACT_ABI,
                functionName: 'getRewardAmount'
            });
            contractBalance = await readContract(window.walletConfig, {
                address: CONTRACT_ADDRESS,
                abi: CONTRACT_ABI,
                functionName: 'getContractBalance'
            });
        } else {
            if (!ethersProvider) {
                const walletProvider = appKitModal.getWalletProvider();
                if (walletProvider) {
                    ethersProvider = new ethers.BrowserProvider(walletProvider);
                }
            }
            const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, ethersProvider);
            remainingClaims = await contract.getRemainingClaimsForFID(0);
            rewardAmount = await contract.getRewardAmount();
            contractBalance = await contract.getContractBalance();
        }
        
        if (Number(remainingClaims) === 0) {
            showSuccessMessage('❌ You already claimed today!');
            return;
        }
        
        if (Number(contractBalance) < Number(rewardAmount)) {
            showSuccessMessage('😔 Prize pool empty!');
            return;
        }
        
        showSuccessMessage('💰 Claiming reward...');
        
        if (isFarcasterEnvironment) {
            const hash = await writeContract(window.walletConfig, {
                address: CONTRACT_ADDRESS,
                abi: CONTRACT_ABI,
                functionName: 'claimReward',
                args: [BigInt(fid || 0), BigInt(window.totalCorrectAnswers)]
            });
            
            const receipt = await waitForTransactionReceipt(window.walletConfig, { hash });
            if (receipt.status !== 'success') {
                throw new Error('Transaction failed');
            }
        } else {
            const signer = await ethersProvider.getSigner();
            const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
            const tx = await contract.claimReward(0, window.totalCorrectAnswers);
            await tx.wait();
        }
        
        showSuccessMessage('🎉 ETH sent to your wallet on Base!');
    } catch (error) {
        console.error('Claim reward error:', error);
        showSuccessMessage('❌ Failed to claim reward');
    }
};

// Leaderboard Functions
window.loadOnChainLeaderboard = async function() {
    try {
        let topPlayers;
        
        if (isFarcasterEnvironment && window.walletConfig) {
            topPlayers = await readContract(window.walletConfig, {
                address: CONTRACT_ADDRESS,
                abi: CONTRACT_ABI,
                functionName: 'getTopPlayers',
                args: [BigInt(50)]
            });
        } else if (ethersProvider) {
            const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, ethersProvider);
            topPlayers = await contract.getTopPlayers(50);
        } else {
            return;
        }
        
        displayOnChainLeaderboard(topPlayers);
    } catch (error) {
        console.error('Load leaderboard error:', error);
        document.getElementById('leaderboardList').innerHTML = 
            `<div class="empty-leaderboard"><p>Failed to load leaderboard</p></div>`;
    }
};

window.fetchPlayerRank = async function() {
    if (!window.isWalletConnected || !window.currentAccount) return null;
    
    try {
        let topPlayers;
        
        if (isFarcasterEnvironment && window.walletConfig) {
            topPlayers = await readContract(window.walletConfig, {
                address: CONTRACT_ADDRESS,
                abi: CONTRACT_ABI,
                functionName: 'getTopPlayers',
                args: [BigInt(50)]
            });
        } else if (ethersProvider) {
            const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, ethersProvider);
            topPlayers = await contract.getTopPlayers(50);
        }
        
        const bestTimesMap = new Map();
        topPlayers.forEach(entry => {
            const address = entry.player.toLowerCase();
            if (!bestTimesMap.has(address) || Number(entry.completionTime) < Number(bestTimesMap.get(address).completionTime)) {
                bestTimesMap.set(address, entry);
            }
        });
        
        const uniquePlayers = Array.from(bestTimesMap.values())
            .sort((a, b) => Number(a.completionTime) - Number(b.completionTime));
        
        const playerAddress = window.currentAccount.address.toLowerCase();
        const rankIndex = uniquePlayers.findIndex(p => p.player.toLowerCase() === playerAddress);
        
        return rankIndex !== -1 ? rankIndex + 1 : null;
    } catch (error) {
        console.error('Fetch rank error:', error);
        return null;
    }
};

async function displayOnChainLeaderboard(players) {
    const listDiv = document.getElementById('leaderboardList');
    
    if (!players || players.length === 0) {
        listDiv.innerHTML = `<div class="empty-leaderboard"><p>No scores yet!</p></div>`;
        return;
    }
    
    const bestTimesMap = new Map();
    players.forEach(entry => {
        const address = entry.player.toLowerCase();
        if (!bestTimesMap.has(address) || Number(entry.completionTime) < Number(bestTimesMap.get(address).completionTime)) {
            bestTimesMap.set(address, entry);
        }
    });
    
    const uniquePlayers = Array.from(bestTimesMap.values())
        .sort((a, b) => Number(a.completionTime) - Number(b.completionTime))
        .slice(0, 50);
    
    const fids = [...new Set(uniquePlayers.map(p => Number(p.farcasterFID)).filter(fid => fid > 0))];
    let profiles = {};
    
    if (fids.length > 0) {
        try {
            const response = await fetch(
                `https://api.neynar.com/v2/farcaster/user/bulk?fids=${fids.join(',')}`,
                {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json',
                        'api_key': NEYNAR_API_KEY
                    }
                }
            );
            
            if (response.ok) {
                const data = await response.json();
                data.users.forEach(user => {
                    profiles[user.fid] = user;
                });
            }
        } catch (error) {
            console.log('Failed to fetch profiles:', error);
        }
    }
    
    listDiv.innerHTML = uniquePlayers.map((entry, idx) => {
        const rankClass = idx === 0 ? 'rank-1' : idx === 1 ? 'rank-2' : idx === 2 ? 'rank-3' : '';
        const rankIcon = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`;
        
        const fid = Number(entry.farcasterFID);
        const profile = profiles[fid];
        
        let avatarHtml, displayName;
        
        if (profile && profile.pfp_url) {
            avatarHtml = `<img src="${profile.pfp_url}" style="width: 40px; height: 40px; border-radius: 8px; margin-right: 10px;">`;
            displayName = profile.display_name || profile.username || 'Player';
        } else {
            const letter = entry.player.substring(2, 3).toUpperCase();
            avatarHtml = `<div style="width: 40px; height: 40px; border-radius: 8px; background: #374151; display: flex; align-items: center; justify-content: center; margin-right: 10px; color: white; font-weight: bold;">${letter}</div>`;
            displayName = fid > 0 ? `FID ${fid}` : 'Anonymous';
        }
        
        return `
            <div class="leaderboard-item ${rankClass}">
                <div class="leaderboard-left">
                    <div class="rank-icon">${rankIcon}</div>
                    ${avatarHtml}
                    <div class="player-info">
                        <div class="player-name">${displayName}</div>
                        <div class="player-time">${window.formatTime(Number(entry.completionTime))}</div>
                        <div class="player-address">${entry.player.substring(0, 6)}...${entry.player.substring(38)}</div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function showSuccessMessage(message) {
    const existingPopup = document.querySelector('.success-popup');
    if (existingPopup) existingPopup.remove();
    
    const popup = document.createElement('div');
    popup.className = 'success-popup';
    popup.textContent = message;
    document.body.appendChild(popup);
    
    setTimeout(() => popup.remove(), 4000);
}

// NFT Functions
window.showNFTMint = async function() {
    const overlay = document.getElementById('nftOverlay');
    const card = document.getElementById('nftMintCard');
    const mintBtn = document.querySelector('.nft-mint-btn');
    
    // Check if user has already minted maximum NFTs
    if (window.isWalletConnected && window.currentAccount) {
        try {
            let remainingMints;
            
            if (isFarcasterEnvironment && window.walletConfig) {
                remainingMints = await readContract(window.walletConfig, {
                    address: NFT_CONTRACT_ADDRESS,
                    abi: NFT_CONTRACT_ABI,
                    functionName: 'getRemainingMints',
                    args: [window.currentAccount.address]
                });
            } else if (ethersProvider) {
                const contract = new ethers.Contract(NFT_CONTRACT_ADDRESS, NFT_CONTRACT_ABI, ethersProvider);
                remainingMints = await contract.getRemainingMints(window.currentAccount.address);
            }
            
            if (remainingMints && Number(remainingMints) === 0) {
                mintBtn.textContent = 'Max Minted (2/2)';
                mintBtn.disabled = true;
                mintBtn.style.background = 'linear-gradient(45deg, #6c757d, #495057)';
                mintBtn.style.cursor = 'not-allowed';
                mintBtn.style.boxShadow = 'none';
            }
        } catch (error) {
            console.log('Could not check remaining mints:', error);
        }
    }
    
    // Fetch current supply
    try {
        let currentSupply;
        
        if (isFarcasterEnvironment && window.walletConfig) {
            currentSupply = await readContract(window.walletConfig, {
                address: NFT_CONTRACT_ADDRESS,
                abi: NFT_CONTRACT_ABI,
                functionName: 'totalSupply'
            });
        } else if (ethersProvider) {
            const contract = new ethers.Contract(NFT_CONTRACT_ADDRESS, NFT_CONTRACT_ABI, ethersProvider);
            currentSupply = await contract.totalSupply();
        }
        
        if (currentSupply !== undefined) {
            const remainingElement = document.querySelector('.nft-remaining');
            remainingElement.textContent = `Minted: ${currentSupply}/999`;
        }
    } catch (error) {
        console.log('Could not fetch current supply:', error);
    }
    
    overlay.classList.add('show');
    setTimeout(() => {
        card.classList.add('show');
    }, 100);
};

window.hideNFTMint = function() {
    const overlay = document.getElementById('nftOverlay');
    const card = document.getElementById('nftMintCard');
    
    card.classList.remove('show');
    
    setTimeout(() => {
        overlay.classList.remove('show');
    }, 400);
    
    setTimeout(() => {
        overlay.style.pointerEvents = 'none';
        card.style.pointerEvents = 'none';
    }, 700);
};

window.mintNFT = async function() {
    const mintBtn = document.querySelector('.nft-mint-btn');
    
    try {
        mintBtn.disabled = true;
        mintBtn.textContent = 'Connecting Wallet...';
        
        if (!window.isWalletConnected || !window.currentAccount) {
            showSuccessMessage('🔗 Please connect your wallet first!');
            mintBtn.disabled = false;
            mintBtn.textContent = 'Mint Now!';
            return;
        }
        
        mintBtn.textContent = 'Preparing Mint...';
        
        // Check remaining mints
        let remainingMints;
        if (isFarcasterEnvironment && window.walletConfig) {
            remainingMints = await readContract(window.walletConfig, {
                address: NFT_CONTRACT_ADDRESS,
                abi: NFT_CONTRACT_ABI,
                functionName: 'getRemainingMints',
                args: [window.currentAccount.address]
            });
        } else if (ethersProvider) {
            const contract = new ethers.Contract(NFT_CONTRACT_ADDRESS, NFT_CONTRACT_ABI, ethersProvider);
            remainingMints = await contract.getRemainingMints(window.currentAccount.address);
        }
        
        if (Number(remainingMints) === 0) {
            mintBtn.textContent = 'Max Minted (2/2)';
            mintBtn.disabled = true;
            mintBtn.style.background = 'linear-gradient(45deg, #6c757d, #495057)';
            mintBtn.style.cursor = 'not-allowed';
            mintBtn.style.boxShadow = 'none';
            showSuccessMessage('❌ You already minted max 2 NFTs!');
            return;
        }
        
        mintBtn.textContent = 'Checking Supply...';
        
        // Check supply
        let totalSupply;
        if (isFarcasterEnvironment && window.walletConfig) {
            totalSupply = await readContract(window.walletConfig, {
                address: NFT_CONTRACT_ADDRESS,
                abi: NFT_CONTRACT_ABI,
                functionName: 'totalSupply'
            });
        } else if (ethersProvider) {
            const contract = new ethers.Contract(NFT_CONTRACT_ADDRESS, NFT_CONTRACT_ABI, ethersProvider);
            totalSupply = await contract.totalSupply();
        }
        
        if (Number(totalSupply) >= 999) {
            showSuccessMessage('😔 NFT collection sold out (999/999)!');
            mintBtn.disabled = false;
            mintBtn.textContent = 'Sold Out';
            return;
        }
        
        mintBtn.textContent = 'Minting NFT...';
        showSuccessMessage('⏳ Minting your NFT...');
        
        // Execute mint
        if (isFarcasterEnvironment && window.walletConfig) {
            const hash = await writeContract(window.walletConfig, {
                address: NFT_CONTRACT_ADDRESS,
                abi: NFT_CONTRACT_ABI,
                functionName: 'mint',
                args: [1n],
                gas: 300000n
            });
            
            mintBtn.textContent = 'Confirming...';
            const receipt = await waitForTransactionReceipt(window.walletConfig, { hash });
            
            if (receipt.status !== 'success') {
                throw new Error('Transaction failed');
            }
        } else if (ethersProvider) {
            const signer = await ethersProvider.getSigner();
            const contract = new ethers.Contract(NFT_CONTRACT_ADDRESS, NFT_CONTRACT_ABI, signer);
            const tx = await contract.mint(1);
            
            mintBtn.textContent = 'Confirming...';
            await tx.wait();
        }
        
        // Success
        mintBtn.textContent = 'Minted! ✅';
        mintBtn.style.background = 'linear-gradient(45deg, #27ae60, #2ecc71)';
        showSuccessMessage('🎉 NFT minted successfully!');
        
        // Update supply
        let updatedSupply;
        if (isFarcasterEnvironment && window.walletConfig) {
            updatedSupply = await readContract(window.walletConfig, {
                address: NFT_CONTRACT_ADDRESS,
                abi: NFT_CONTRACT_ABI,
                functionName: 'totalSupply'
            });
        } else if (ethersProvider) {
            const contract = new ethers.Contract(NFT_CONTRACT_ADDRESS, NFT_CONTRACT_ABI, ethersProvider);
            updatedSupply = await contract.totalSupply();
        }
        
        const remainingElement = document.querySelector('.nft-remaining');
        remainingElement.textContent = `Minted: ${updatedSupply}/999`;
        
        // Close modal
        setTimeout(() => {
            hideNFTMint();
            setTimeout(() => {
                mintBtn.disabled = false;
                mintBtn.textContent = 'Mint Now!';
                mintBtn.style.background = 'linear-gradient(45deg, #3b82f6, #1d4ed8)';
            }, 500);
        }, 3000);
        
    } catch (error) {
        console.error('Minting failed:', error);
        
        let errorMessage = 'Minting failed. Please try again.';
        if (error.message && error.message.includes('insufficient funds')) {
            errorMessage = 'Insufficient ETH for gas fees.';
        } else if (error.message && (error.message.includes('rejected') || error.message.includes('denied'))) {
            errorMessage = 'Transaction rejected.';
        }
        
        showSuccessMessage('❌ ' + errorMessage);
        
        mintBtn.disabled = false;
        mintBtn.textContent = 'Mint Now!';
        mintBtn.style.background = 'linear-gradient(45deg, #3b82f6, #1d4ed8)';
    }
};

// Initialize on load
(async () => {
    try {
        await detectEnvironment();
        
        if (isFarcasterEnvironment) {
            if (sdk?.actions?.addMiniApp) {
                await sdk.actions.addMiniApp();
            }
            sdk.actions.ready({ disableNativeGestures: true });
            await fetchFarcasterProfile();
            await initializeFarcasterWallet();
        } else {
            await initializeReownWallet();
        }
        
        // Show NFT popup after initialization
        setTimeout(() => {
            showNFTMint();
        }, 1000);
    } catch (err) {
        console.error('Initialization error:', err);
    }
})();

// Game State Variables
window.gameState = 'ready';
window.currentQuestion = 0;
window.correctAnswers = [false, false, false, false];
window.correctAnswer = 0;
window.isAnswered = false;
window.gameStartTime = 0;
window.currentGameTime = 0;
window.timerInterval = null;
window.fallTimeout = null;
window.totalCorrectAnswers = 0;
window.playerRank = null;

// Game Logic Functions
window.generateQuestion = function() {
    const a = Math.floor(Math.random() * 10) + 1;
    const b = Math.floor(Math.random() * 10) + 1;
    const operations = ['+', '-', '×'];
    const op = operations[Math.floor(Math.random() * 3)];
    
    let correct, questionText;
    
    if (op === '+') {
        correct = a + b;
        questionText = `${a} + ${b}`;
    } else if (op === '-') {
        const [num1, num2] = a > b ? [a, b] : [b, a];
        correct = num1 - num2;
        questionText = `${num1} - ${num2}`;
    } else {
        correct = a * b;
        questionText = `${a} × ${b}`;
    }
    
    window.correctAnswer = correct;
    document.getElementById('question').textContent = `${questionText} = ?`;
    
    const wrongAnswers = [
        correct + Math.floor(Math.random() * 5) + 1,
        correct - Math.floor(Math.random() * 5) - 1,
        correct + Math.floor(Math.random() * 10) + 5
    ].filter(ans => ans !== correct && ans > 0);
    
    const allAnswers = [correct, ...wrongAnswers.slice(0, 3)]
        .sort(() => Math.random() - 0.5);
    
    window.createFallingAnswers(allAnswers);
};

window.createFallingAnswers = function(answers) {
    const fallingArea = document.getElementById('fallingArea');
    fallingArea.innerHTML = '';
    window.isAnswered = false;
    
    answers.forEach((ans) => {
        const answerDiv = document.createElement('div');
        answerDiv.className = 'falling-answer';
        answerDiv.textContent = ans;
        answerDiv.onclick = () => window.handleAnswerClick(ans);
        fallingArea.appendChild(answerDiv);
    });
    
    window.fallTimeout = setTimeout(() => {
        if (!window.isAnswered) window.handleMiss();
    }, 6000);
};

window.handleAnswerClick = function(selected) {
    if (window.isAnswered) return;
    window.isAnswered = true;
    clearTimeout(window.fallTimeout);
    
    if (selected === window.correctAnswer) {
        const correctSound = document.getElementById('correctSound');
        correctSound.currentTime = 0;
        correctSound.play().catch(e => {});
        
        window.correctAnswers[window.currentQuestion] = true;
        window.totalCorrectAnswers++;
        window.updateProgressBoxes();
        window.showFeedback('🎉 Correct!', 'correct');
        
        if (window.currentQuestion === 3) {
            clearInterval(window.timerInterval);
            setTimeout(() => window.showWinScreen(), 800);
        } else {
            setTimeout(() => {
                window.currentQuestion++;
                window.updateQuestionNumber();
                window.generateQuestion();
                document.getElementById('feedback').textContent = '';
            }, 800);
        }
    } else {
        const wrongSound = document.getElementById('wrongSound');
        wrongSound.currentTime = 0;
        wrongSound.play().catch(e => {});
        
        window.showFeedback('❌ Wrong!', 'wrong');
        clearInterval(window.timerInterval);
        setTimeout(() => window.showGameOver(), 800);
    }
};

window.handleMiss = function() {
    const wrongSound = document.getElementById('wrongSound');
    wrongSound.currentTime = 0;
    wrongSound.play().catch(e => {});
    
    window.showFeedback('⏱️ Too slow!', 'wrong');
    clearInterval(window.timerInterval);
    setTimeout(() => window.showGameOver(), 800);
};

window.showFeedback = function(text, type) {
    const feedback = document.getElementById('feedback');
    feedback.textContent = text;
    feedback.className = `feedback ${type}`;
};

window.updateProgressBoxes = function() {
    const boxes = document.querySelectorAll('.progress-box');
    boxes.forEach((box, idx) => {
        if (window.correctAnswers[idx]) {
            box.className = 'progress-box correct';
            box.innerHTML = '✓';
        } else if (idx === window.currentQuestion) {
            box.className = 'progress-box active';
            box.textContent = idx + 1;
        } else {
            box.className = 'progress-box inactive';
            box.textContent = idx + 1;
        }
    });
};

window.updateQuestionNumber = function() {
    document.getElementById('questionNumber').textContent = 
        `Question ${window.currentQuestion + 1} of 4`;
};

window.formatTime = function(ms) {
    const seconds = Math.floor(ms / 1000);
    const milliseconds = Math.floor((ms % 1000) / 10);
    return `${seconds}.${milliseconds.toString().padStart(2, '0')}s`;
};

window.showWinScreen = async function() {
    const winSound = document.getElementById('winSound');
    winSound.currentTime = 0;
    winSound.play().catch(e => {});
    
    document.getElementById('gameScreen').classList.add('hidden');
    document.getElementById('resultScreen').classList.remove('hidden');
    document.getElementById('timerDisplay').classList.add('hidden');
    
    document.getElementById('resultIcon').textContent = '🏆';
    document.getElementById('resultTitle').textContent = 'You Win!';
    document.getElementById('resultText').textContent = 'Perfect Score! 4/4 correct! 🎉';
    document.getElementById('resultTime').textContent = 
        `⏱️ ${window.formatTime(window.currentGameTime)}`;
    
    if (window.fetchPlayerRank) {
        window.playerRank = await window.fetchPlayerRank();
    }
};

window.showGameOver = function() {
    document.getElementById('gameScreen').classList.add('hidden');
    document.getElementById('resultScreen').classList.remove('hidden');
    document.getElementById('timerDisplay').classList.add('hidden');
    
    document.getElementById('resultIcon').textContent = '💥';
    document.getElementById('resultTitle').textContent = 'Game Over!';
    document.getElementById('resultText').textContent = 
        `You got ${window.correctAnswers.filter(Boolean).length} out of 4 correct`;
};

window.playAgain = function() {
    window.gameState = 'ready';
    window.playerRank = null;
    document.getElementById('resultScreen').classList.add('hidden');
    document.getElementById('startScreen').classList.remove('hidden');
};

window.showLeaderboard = function() {
    document.getElementById('resultScreen').classList.add('hidden');
    document.getElementById('leaderboardScreen').classList.remove('hidden');
    window.loadOnChainLeaderboard();
};

window.toggleLeaderboard = function() {
    const leaderboardScreen = document.getElementById('leaderboardScreen');
    const startScreen = document.getElementById('startScreen');
    const gameScreen = document.getElementById('gameScreen');
    const resultScreen = document.getElementById('resultScreen');
    
    if (leaderboardScreen.classList.contains('hidden')) {
        leaderboardScreen.classList.remove('hidden');
        startScreen.classList.add('hidden');
        gameScreen.classList.add('hidden');
        resultScreen.classList.add('hidden');
        window.loadOnChainLeaderboard();
    } else {
        window.hideLeaderboard();
    }
};

window.hideLeaderboard = function() {
    document.getElementById('leaderboardScreen').classList.add('hidden');
    document.getElementById('startScreen').classList.remove('hidden');
};

window.shareGame = function() {
    let shareText = `🔥 Just completed Quick Math in ${window.formatTime(window.currentGameTime)}!\n\n`;
    
    if (window.playerRank !== null) {
        if (window.playerRank === 1) {
            shareText += '🥇 Rank #1\n';
        } else if (window.playerRank === 2) {
            shareText += '🥈 Rank #2\n';
        } else if (window.playerRank === 3) {
            shareText += '🥉 Rank #3\n';
        } else {
            shareText += `🏆 Rank #${window.playerRank}\n`;
        }
    }
    
    shareText += '📋 4/4 correct - Score submitted onchain.\n➤ Claimed my reward.\n🥷🏻 Beat my time if you can!';
    
    const encodedText = encodeURIComponent(shareText);
    const shareUrl = encodeURIComponent('https://quick-mathquiz.vercel.app');
    const castUrl = `https://farcaster.xyz/~/compose?text=${encodedText}&embeds[]=${shareUrl}`;
    
    window.open(castUrl, '_blank');
};

// Event Listeners
document.getElementById('nftOverlay').addEventListener('click', function(event) {
    if (event.target === this) {
        hideNFTMint();
    }
});

document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        hideNFTMint();
    }
});