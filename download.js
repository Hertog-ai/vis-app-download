const trustedKey = 'd53d57a80bdee7f39d66d6df0add9d209b773f872d13e789d9149e60943f8223';
const officialApk = /^https:\/\/github\.com\/Hertog-ai\/vis-app-download\/releases\/download\/(?!\.{1,2}\/)[\w.-]+\/[\w.-]+\.apk$/i;
const hex = value => Uint8Array.from(value.match(/../g), pair => parseInt(pair, 16));

async function showVerifiedRelease() {
  const status = document.getElementById('status');
  let response;
  try {
    response = await fetch('./update-config.json', {cache:'no-store', redirect:'error'});
  } catch {
    status.textContent = 'De downloadgegevens konden niet worden opgehaald. Controleer je internetverbinding en probeer opnieuw.';
    return;
  }
  if (!response.ok) {
    status.textContent = 'De downloadgegevens zijn momenteel niet beschikbaar.';
    return;
  }
  try {
    const raw = await response.text();
    if (raw.length > 8192) throw new Error();
    const envelope = JSON.parse(raw);
    if (envelope === null) {
      status.textContent = 'Er is nog geen goedgekeurde Android-APK beschikbaar.';
      return;
    }
    if (typeof envelope.payload !== 'string' || envelope.payload.length > 4096 ||
        typeof envelope.signature !== 'string' || !/^[a-f0-9]{128}$/.test(envelope.signature)) throw new Error();
    let subtle, key;
    try {
      subtle = globalThis.crypto.subtle;
      key = await subtle.importKey('raw', hex(trustedKey), 'Ed25519', false, ['verify']);
    } catch {
      status.textContent = 'Deze browser kan de downloadhandtekening niet controleren. Gebruik Chrome 137 of nieuwer, of Safari 17 of nieuwer.';
      return;
    }
    if (!await subtle.verify('Ed25519', key, hex(envelope.signature), new TextEncoder().encode(envelope.payload))) {
      status.textContent = 'De handtekening van de download klopt niet. De download is geblokkeerd.';
      return;
    }
    const release = JSON.parse(envelope.payload);
    const publishedAt = Date.parse(release.publishedAt);
    if (release.schema !== 1 || release.purpose !== 'visapp-approved-download' || release.package !== 'nl.hertog.visapp' ||
        !Number.isSafeInteger(release.versionCode) || release.versionCode < 7 || release.versionCode > 2100000000 ||
        typeof release.versionName !== 'string' || !/^\d+(?:\.\d+){1,3}(?:-[a-z0-9.]+)?$/i.test(release.versionName) || release.versionName.length > 32 ||
        typeof release.url !== 'string' || release.url.length > 500 || !officialApk.test(release.url) ||
        !Number.isSafeInteger(release.bytes) || release.bytes <= 0 || release.bytes >= 2**31 ||
        typeof release.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(release.sha256) ||
        !Number.isFinite(publishedAt) || new Date(publishedAt).toISOString() !== release.publishedAt ||
        publishedAt > Date.now() + 300000) throw new Error();
    if (Object.hasOwn(release, 'expiresAt')) {
      status.textContent = 'De downloadgegevens hebben een ongeldige geldigheidsduur. De download is geblokkeerd.';
      return;
    }
    const apk = document.getElementById('apk');
    const details = document.getElementById('controle');
    apk.href = release.url;
    status.textContent = `Goedgekeurde versie ${release.versionName} · Android-build ${release.versionCode} · ${release.bytes.toLocaleString('nl-NL')} bytes.`;
    details.textContent = `Verwachte SHA-256 van de APK: ${release.sha256}`;
    details.hidden = false;
    apk.hidden = false;
  } catch {
    status.textContent = 'De downloadgegevens zijn beschadigd of ongeldig. De download is geblokkeerd.';
  }
}

showVerifiedRelease();
