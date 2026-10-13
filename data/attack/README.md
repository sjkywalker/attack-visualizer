# ATT&CK data

The directory contains the official MITRE ATT&CK v19.2 STIX bundles for the
Enterprise, Mobile, and ICS domains:

- `enterprise-attack.json`
- `mobile-attack.json`
- `ics-attack.json`

The application loads all three once during startup and does not require Internet access afterward.
The data remains subject to MITRE's terms in `LICENSE.txt`; it is not relicensed
under the ATT&CK Visualizer project license.

To replace the version, download all three matching bundles from the official
`mitre-attack/attack-stix-data` repository, keep these filenames, update the configured
version, and restart the application. Do not mix domain releases from different versions.
