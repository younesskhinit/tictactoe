const screens = ['home', 'waiting', 'game'];

function display(screen) {
  screens.forEach((name) => {
    if (screen !== name)
      document.getElementById(`${name}-screen`).style.display = 'none';
  });
  document.getElementById(`${screen}-screen`).style.display = 'block';
}
