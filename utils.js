function formatDuration(duration) {
  const sec = Math.floor(duration % 60);
  const min = Math.floor((duration / 60) % 60);
  const hr = Math.floor(duration / 3600);
  return `${hr > 0 ? hr + "h " : ""}${min > 0 ? min + "m " : ""}${sec}s`;
}

function formatUptime(ms) {
  const sec = Math.floor(ms / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);
  return `${day > 0 ? day + "d " : ""}${hr % 24}h ${min % 60}m ${sec % 60}s`;
}

module.exports = {
  formatDuration,
  formatUptime
};