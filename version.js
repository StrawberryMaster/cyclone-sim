const versionLink = document.getElementById('version');
class Version {
  constructor(prefix, number) {
    this.prefix = prefix;
    this.number = number;
  }

  toString() {
    return `${this.prefix}${this.number}`;
  }
}

function setVersion(prefix, number) {
  versionLink.innerHTML = new Version(prefix, number);
}

if (versionLink.tagName === 'A') {
  versionLink.setAttribute('href', './changelog.txt');
}