// Previous-step suites explicitly acknowledge a normal opening before testing gameplay.
module.exports = async page => {
  await page.evaluate(async () => {
    const { acknowledgeOpening } = await import('/js/game.js?v=core-ui-stall-grid');
    const debug = window.NMLDebug;
    window.NMLDebug = Object.freeze({ ...debug, newGame: settings => {
      const state = debug.newGame(settings, () => 0); acknowledgeOpening(); return state;
    } });
    const nativeRandom = Math.random;
    document.addEventListener('submit', event => {
      if (event.target.id !== 'home-form') return;
      Math.random = () => 0;
      setTimeout(() => { Math.random = nativeRandom; }, 0);
    }, true);
  });
};
