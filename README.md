# The Cursed Village 1996 - Multiplayer Card Game

A multiplayer card game based on Salem witch trials, where players take on roles as either witches or townsfolk, using cards to eliminate opponents and achieve victory.

## 🎮 Game Features

### Core Gameplay
- **Multiplayer Support**: Real-time multiplayer gameplay with Socket.IO
- **Role-Based Gameplay**: Players are assigned as either witches or townsfolk
- **Card-Based Strategy**: 18 unique cards with different abilities
- **Dynamic Phases**: Day and night phases with different mechanics
- **Real-Time Chat**: Separate chat systems for witches and general game messages

### Visual Enhancements
- **Card Images**: All cards display with custom PNG images instead of text
- **Responsive Design**: Optimized for desktop, tablet, and mobile devices
- **Modern UI**: Beautiful gradient backgrounds and smooth animations
- **Interactive Elements**: Hover effects, drag-and-drop card reordering

### Game End Features
- **Comprehensive Statistics**: Detailed game statistics display at the end
- **Winner Celebration**: Special winner announcement with role icons
- **Player Role Reveal**: Shows all players' roles and survival status
- **Navigation Options**: Choose to return to lobby or go to name setup
- **Game Summary**: Displays round count, final phase, and player count

## 🏗️ Project Structure

```
The-cursed-village-1996-main/
├── src/
│   ├── gameLogic.js      # Core game mechanics and logic
│   └── utils.js          # Utility functions and helpers
├── public/
│   ├── cards/            # Card image assets (PNG files)
│   ├── index.html        # Main game interface
│   ├── script.js         # Client-side game logic
│   └── style.css         # Styling and responsive design
├── tests/
│   ├── gameLogic.test.js # Game logic unit tests
│   ├── integration.test.js # Integration tests
│   ├── server.test.js    # Server functionality tests
│   └── utils.test.js     # Utility function tests
├── server.js             # Socket.IO server and game management
├── package.json          # Dependencies and scripts
└── README.md            # This file
```

## 🚀 Quick Start

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn

### Installation
```bash
# Clone the repository
git clone <repository-url>
cd The-cursed-village-1996-main

# Install dependencies
npm install

# Start the development server
npm start

# Run tests
npm test

# Build for production
npm run build

# Build optimized for Render deployment
npm run build:render
```

### Development Scripts
```bash
npm start          # Start development server
npm test           # Run all tests
npm run test:watch # Run tests in watch mode
npm run lint       # Run ESLint
npm run build      # Build for production
npm run dev        # Start with nodemon for development
```

## 🎯 Game Rules

### Objective
- **Witches**: Eliminate all constables to win
- **Townsfolk**: Eliminate all witches to win

### Game Phases
1. **Day Phase**: Players draw cards, play actions, and vote
2. **Night Phase**: Witches can kill, constables can protect

### Card Types
- **Red Cards**: Attack and elimination cards
- **Blue Cards**: Protection and utility cards
- **Green Cards**: Special abilities and effects
- **Tryal Cards**: Reveal player roles

### Win Conditions
- Witches win when they outnumber constables
- Constables win when all witches are eliminated
- Game ends when minimum player count drops below 4

## 📊 Game End Statistics

When a game ends, players see a comprehensive statistics screen that includes:

### Winner Information
- **Winner Team**: Clear display of winning team (Witches 🧙‍♀️ or Townsfolk 🛡️)
- **Winner Icon**: Large animated icon representing the winning team

### Game Statistics
- **Player Count**: Total number of players in the game
- **Round Count**: Number of rounds played
- **Final Phase**: The phase when the game ended

### Player Information
- **Role Reveal**: All players' roles are revealed
- **Survival Status**: Shows who survived and who died
- **Role Icons**: Visual indicators for witches and townsfolk

### Navigation Options
- **Return to Lobby**: Go back to room selection
- **Name Setup**: Change player name and start fresh

## 🔧 Technical Features

### Testing
- **Jest Framework**: Comprehensive test suite
- **Unit Tests**: Individual function testing
- **Integration Tests**: End-to-end game flow testing
- **Server Tests**: Socket.IO and server functionality
- **Coverage**: High test coverage for critical functions

### Code Quality
- **ESLint**: Code linting and style enforcement
- **Modular Design**: Separated concerns and reusable components
- **Error Handling**: Comprehensive error management
- **Performance**: Optimized for real-time gameplay

### Build System
- **Webpack**: Client-side bundling and minification
- **Asset Optimization**: Image compression and caching
- **Development Tools**: Hot reloading and debugging

## 🌐 API Events

### Client to Server
- `join room`: Join a game room
- `leave room`: Leave current room
- `start game`: Start the game
- `play card`: Play a card from hand
- `draw card`: Draw a card from deck
- `end turn`: End current turn
- `vote`: Vote during trial phase
- `witch chat`: Send witch-only message

### Server to Client
- `room state update`: Update game state
- `your turn`: Notify player it's their turn
- `game message`: Display game message
- `update hand`: Update player's hand
- `game over`: End game notification
- `witch chat message`: Receive witch chat message

## 🎨 UI Components

### Game Interface
- **Player Grid**: Real-time player status display
- **Card Hand**: Interactive card management
- **Game Messages**: Real-time game log
- **Action Buttons**: Turn-based action controls
- **Phase Indicators**: Current game phase display

### Responsive Design
- **Desktop**: Full-featured interface
- **Tablet**: Optimized touch controls
- **Mobile**: Simplified mobile layout
- **Cross-Platform**: Works on all devices

## 🚀 Deployment

### Production Build
```bash
npm run build
npm start
```

### Render Deployment (Recommended)
```bash
# Build optimized for Render
npm run build:render

# Deploy using render.yaml
# The project includes optimized configuration for Render
```

### Environment Variables
- `PORT`: Server port (default: 3000)
- `NODE_ENV`: Environment mode (production/development)
- `ALLOWED_ORIGINS`: CORS origins for production

### Performance Optimizations
- **Image Compression**: Optimized card images (60-80% compression)
- **Code Minification**: Reduced bundle size with tree shaking
- **Caching**: Static asset caching with ETags
- **Memory Management**: Automatic cleanup and monitoring
- **WebSocket Optimization**: Optimized Socket.IO configuration
- **Security Headers**: Helmet.js for production security
- **Compression**: Gzip compression for all responses
- **Health Checks**: Built-in monitoring endpoint

### Render-Specific Features
- **Health Check Endpoint**: `/health` for monitoring
- **Graceful Shutdown**: Proper cleanup on SIGTERM/SIGINT
- **Memory Monitoring**: Automatic memory usage logging
- **Asset Optimization**: PNG compression and lazy loading
- **Docker Support**: Multi-stage Docker builds
- **Auto-scaling Ready**: Optimized for horizontal scaling

## 🤝 Contributing

### Development Guidelines
1. **Testing**: Write tests for new features
2. **Linting**: Follow ESLint rules
3. **Documentation**: Update README for changes
4. **Performance**: Optimize for real-time gameplay

### Code Style
- **JavaScript**: ES6+ features
- **CSS**: BEM methodology
- **HTML**: Semantic markup
- **Comments**: Clear documentation

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🎮 Game Credits

- **Theme**: Salem Witch Trials
- **Design**: Modern multiplayer card game
- **Technology**: Node.js, Socket.IO, HTML5, CSS3, JavaScript
- **Testing**: Jest framework
- **Build**: Webpack bundling system
- **Deployment**: Optimized for Render with Docker support

## 📚 Additional Documentation

- [Render Deployment Guide](DEPLOYMENT.md) - Complete deployment instructions
- [Performance Optimization Guide](DEPLOYMENT.md#performance-optimizations) - Detailed optimization strategies

---

**Enjoy playing The Cursed Village 1996!** 🧙‍♀️🛡️
