const versionLink = document.getElementById('version');

const Version = {
  number: '0.0',
  prefix: 'v',
};

function setVersion(p, n) {
  Version.prefix = p;
  Version.number = n;
  versionLink.innerHTML = `${Version.prefix}${Version.number}`;
}

if (versionLink.tagName === 'A') {
  versionLink.setAttribute('href', './changelog.txt');
}

versionLink.innerHTML = `${Version.prefix}${Version.number}`;