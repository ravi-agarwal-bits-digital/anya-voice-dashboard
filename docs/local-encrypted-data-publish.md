# Publish a larger encrypted data export

Use this temporary route when Admin has validated the CSV but says browser publishing is too large. It bypasses GitHub's Contents API; it does not change the dashboard, its encryption, or the data format.

## In Admin

1. Validate the export and review the counts.
2. Tick the publication confirmation.
3. Choose **Download encrypted package**. Two files download: an `.enc` artifact and a `.publish.json` manifest. Keep both together.

The artifact is encrypted with the Admin passphrase. Neither downloaded file contains the raw CSV or the passphrase.

## First time only

Install Git and Node 18+ on a computer with access to this repository, then create a local clone:

```bash
git clone https://github.com/ravi-agarwal-bits-digital/anya-voice-dashboard.git
cd anya-voice-dashboard
```

Authenticate Git once using your normal GitHub account. For GitHub CLI users:

```bash
gh auth setup-git
```

## Each larger upload

From the clean local clone on `main`, run:

```bash
node scripts/publish-encrypted-data.js \
  --artifact /path/to/anya-voice-data-...enc \
  --metadata /path/to/anya-voice-data-...publish.json
```

The helper verifies the artifact signature, manifest paths, checksum, duplicate fingerprint, clean working tree and fast-forward pull before it writes anything. It then makes two ordinary commits on `main`: the encrypted data, followed by its public-safe freshness fingerprint. It never force-pushes.

The encrypted artifact must be under 95 MiB, below GitHub's normal file-size hard limit. This is a safe bridge for growing CSV exports—not the permanent scaling solution. Move the vendor feed to object storage or a database before compressed encrypted artifacts approach that ceiling.
