// Utility Functions Module

/**
 * Generate a random room code
 * @returns {string} 4-character uppercase alphanumeric code
 */
function generateRoomCode() {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
}

/**
 * Shuffle an array using Fisher-Yates algorithm
 * @param {Array} array - Array to shuffle
 * @returns {Array} Shuffled array
 */
function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Generate a UUID v4
 * @returns {string} UUID v4 string
 */
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Deep clone an object
 * @param {Object} obj - Object to clone
 * @returns {Object} Cloned object
 */
function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime());
  if (obj instanceof Array) return obj.map(item => deepClone(item));
  if (typeof obj === 'object') {
    const clonedObj = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        clonedObj[key] = deepClone(obj[key]);
      }
    }
    return clonedObj;
  }
}

/**
 * Validate room name
 * @param {string} roomName - Room name to validate
 * @returns {boolean} True if valid
 */
function isValidRoomName(roomName) {
  return !!(roomName && 
         typeof roomName === 'string' && 
         roomName.trim().length > 0 && 
         roomName.trim().length <= 20);
}

/**
 * Validate player name
 * @param {string} playerName - Player name to validate
 * @returns {boolean} True if valid
 */
function isValidPlayerName(playerName) {
  return !!(playerName && 
         typeof playerName === 'string' && 
         playerName.trim().length > 0 && 
         playerName.trim().length <= 15);
}

/**
 * Get current timestamp
 * @returns {number} Current timestamp in milliseconds
 */
function getCurrentTimestamp() {
  return Date.now();
}

/**
 * Format timestamp for display
 * @param {number} timestamp - Timestamp to format
 * @returns {string} Formatted time string
 */
function formatTimestamp(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString();
}

/**
 * Debounce function calls
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle function calls
 * @param {Function} func - Function to throttle
 * @param {number} limit - Time limit in milliseconds
 * @returns {Function} Throttled function
 */
function throttle(func, limit) {
  let inThrottle;
  return function() {
    const args = arguments;
    const context = this;
    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * Check if two arrays have the same elements
 * @param {Array} arr1 - First array
 * @param {Array} arr2 - Second array
 * @returns {boolean} True if arrays have same elements
 */
function arraysEqual(arr1, arr2) {
  if (arr1.length !== arr2.length) return false;
  const sorted1 = [...arr1].sort();
  const sorted2 = [...arr2].sort();
  return sorted1.every((val, index) => val === sorted2[index]);
}

/**
 * Get random element from array
 * @param {Array} array - Array to get random element from
 * @returns {*} Random element
 */
function getRandomElement(array) {
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Get random number between min and max (inclusive)
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} Random number
 */
function getRandomNumber(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Check if object is empty
 * @param {Object} obj - Object to check
 * @returns {boolean} True if object is empty
 */
function isEmpty(obj) {
  if (obj === null || obj === undefined) return false;
  return obj && Object.keys(obj).length === 0 && obj.constructor === Object;
}

/**
 * Merge objects deeply
 * @param {Object} target - Target object
 * @param {Object} source - Source object
 * @returns {Object} Merged object
 */
function deepMerge(target, source) {
  const result = { ...target };
  for (const key in source) {
    if (source.hasOwnProperty(key)) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = deepMerge(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
  }
  return result;
}

module.exports = {
  generateRoomCode,
  shuffleArray,
  generateUUID,
  deepClone,
  isValidRoomName,
  isValidPlayerName,
  getCurrentTimestamp,
  formatTimestamp,
  debounce,
  throttle,
  arraysEqual,
  getRandomElement,
  getRandomNumber,
  isEmpty,
  deepMerge
}; 