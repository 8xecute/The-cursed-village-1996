// The wall gun is a decorative story interaction. Legacy clients cannot acquire or fire it.
module.exports = function registerPrank(socket) {
    socket.on('prank gun pickup', () => {});
    socket.on('prank gun shoot', () => {});
};
