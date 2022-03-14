const sounds = {
  select: 'sounds/select.mp3',
  play: 'sounds/play.mp3',
};

function play(name) {
  const sound = new Audio(sounds[name]);
  sound.play();
}
