const versionLink = document.getElementById("version");

const Version = {
  number: "0.0",
  prefix: "v",
};

function versionLinkUpdate() {
  versionLink.innerHTML = `${Version.prefix}${Version.number}`;
}

function setVersion(p, n) {
  Version.prefix = p;
  Version.number = n;
  versionLinkUpdate();
}

if (versionLink.tagName === "A") {
  versionLink.setAttribute("href", "./changelog.txt");
}

versionLinkUpdate();
