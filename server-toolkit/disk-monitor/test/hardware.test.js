const { test } = require("node:test");
const assert = require("node:assert/strict");
const { buildDisksFromLsblk, buildNetworkShares, applyIdentity, diskOfPath } = require("../lib/hardware");
const { planDiskCleanup } = require("../lib/cleanup");

const GB = 1000 ** 3;
// Máquina do cliente: 120 GB (sistema), 480 GB com 2 partições, 480 GB com 1.
const lsblk = {
  blockdevices: [
    { name: "loop0", kname: "loop0", type: "loop", size: "65000000", mountpoint: "/snap/core/1" },
    { name: "zram0", kname: "zram0", type: "disk", size: 0 },
    { name: "sr0", kname: "sr0", type: "rom", size: "1073741312", rm: "1" },
    {
      name: "sda", kname: "sda", type: "disk", size: String(120 * GB), model: "KINGSTON SA400S37120G ", serial: "50026B77", rota: "0", tran: "sata", rm: "0",
      children: [
        { name: "sda1", kname: "sda1", type: "part", size: String(1 * GB), fstype: "vfat", mountpoint: "/boot/efi" },
        { name: "sda2", kname: "sda2", type: "part", size: String(115 * GB), fstype: "ext4", mountpoint: "/" },
        { name: "sda3", kname: "sda3", type: "part", size: String(4 * GB), fstype: "swap", mountpoint: "[SWAP]" }
      ]
    },
    {
      name: "sdb", kname: "sdb", type: "disk", size: String(480 * GB), model: "WDC WDS480G2G0A", rota: false, tran: "sata", rm: false,
      children: [
        { name: "sdb1", kname: "sdb1", type: "part", size: String(240 * GB), fstype: "ext4", label: "seafile", mountpoint: "/srv/seafile-data" },
        { name: "sdb2", kname: "sdb2", type: "part", size: String(240 * GB), fstype: "ext4", mountpoint: null }
      ]
    },
    {
      name: "sdd", kname: "sdd", type: "disk", size: String(1000 * GB), model: "TOSHIBA EXT", rota: "1", tran: "usb", rm: "0",
      children: [{ name: "sdd1", kname: "sdd1", type: "part", size: String(1000 * GB), fstype: "ntfs", mountpoint: "/run/media/sandro/TOSHIBA EXT" }]
    },
    {
      name: "sdc", kname: "sdc", type: "disk", size: String(480 * GB), model: "ST500DM002", rota: "1", tran: "sata",
      children: [
        { name: "sdc1", kname: "sdc1", type: "part", size: String(480 * GB), fstype: "LVM2_member", mountpoint: null,
          children: [{ name: "vg-dados", kname: "dm-0", type: "lvm", size: String(480 * GB), fstype: "ext4", mountpoint: "/mnt/dados" }] }
      ]
    }
  ]
};
const usage = new Map([
  ["/", { totalBytes: 113 * GB, usedBytes: 60 * GB, availBytes: 53 * GB, percent: 53 }],
  ["/boot/efi", { totalBytes: 1 * GB, usedBytes: 0.1 * GB, availBytes: 0.9 * GB, percent: 10 }],
  ["/srv/seafile-data", { totalBytes: 236 * GB, usedBytes: 100 * GB, availBytes: 136 * GB, percent: 42 }],
  ["/mnt/dados", { totalBytes: 470 * GB, usedBytes: 47 * GB, availBytes: 423 * GB, percent: 10 }],
  // montagens que NÃO podem virar disco
  ["/var/lib/docker/overlay2/abc/merged", { totalBytes: 113 * GB, usedBytes: 60 * GB, availBytes: 53 * GB, percent: 53 }],
  ["/mnt/nas-backup", { totalBytes: 4000 * GB, usedBytes: 1000 * GB, availBytes: 3000 * GB, percent: 25 }]
]);

test("mostra só os 3 discos físicos, com as partições certas", () => {
  const disks = buildDisksFromLsblk(lsblk, usage);
  assert.deepEqual(disks.map(d => d.id), ["sda", "sdb", "sdc", "sdd"]);
  assert.deepEqual(disks.map(d => d.external), [false, false, false, true]); // USB = externo
  const [sys, dois, um] = disks;

  assert.equal(sys.system, true);
  assert.equal(sys.kind, "SSD");
  assert.equal(sys.model, "KINGSTON SA400S37120G");
  assert.deepEqual(sys.partitions.map(p => [p.id, p.mount, p.swap]), [["sda1", "/boot/efi", false], ["sda2", "/", false], ["sda3", null, true]]);
  assert.equal(sys.usage.percent, Math.round((60.1 / 114) * 100));

  assert.equal(dois.partitions.length, 2);
  assert.equal(dois.partitions[0].mount, "/srv/seafile-data");
  assert.equal(dois.partitions[0].percent, 42);
  assert.equal(dois.partitions[1].mount, null); // não montada: aparece, sem uso
  assert.equal(dois.partitions[1].sizeBytes, 240 * GB);

  assert.equal(um.kind, "HDD");
  assert.equal(um.partitions.length, 1);
  assert.equal(um.partitions[0].mount, "/mnt/dados"); // LVM em cima da partição
  assert.equal(um.partitions[0].fsType, "ext4");
});

test("descobre em qual disco fica um caminho", () => {
  const disks = buildDisksFromLsblk(lsblk, usage);
  assert.equal(diskOfPath(disks, "/").disk.id, "sda");
  assert.equal(diskOfPath(disks, "/nao/existe"), null);
});

// /proc/mounts real do servidor: NAS em cifs, overlay do Docker, efivarfs...
const procMounts = [
  "/dev/sda2 / ext4 rw,relatime 0 0",
  "efivarfs /sys/firmware/efi/efivars efivarfs rw 0 0",
  "overlay /var/lib/docker/overlay2/abc/merged overlay rw 0 0",
  "//192.168.3.21/backup /mnt/nas-backup cifs rw,vers=3.0 0 0",
  "//192.168.3.21/seafile /mnt/nas-seafile cifs rw,vers=3.0 0 0",
  "192.168.3.30:/export/fotos /mnt/fotos\\040antigas nfs4 rw 0 0"
].join("\n");

test("NAS aparecem como grupo próprio e identificados", () => {
  const nasUsage = new Map(usage);
  nasUsage.set("/mnt/nas-seafile", { totalBytes: 960 * GB, usedBytes: 96 * GB, availBytes: 864 * GB, percent: 10 });
  const shares = buildNetworkShares(procMounts, nasUsage);
  assert.deepEqual(shares.map(s => s.partitions[0].mount), ["/mnt/fotos antigas", "/mnt/nas-backup", "/mnt/nas-seafile"]);
  const [fotos, backup, seafile] = shares;
  assert.equal(backup.network, true);
  assert.equal(backup.server, "192.168.3.21");
  assert.equal(backup.share, "backup");
  assert.equal(backup.transport, "smb");
  assert.equal(backup.partitions[0].role, "backup");
  assert.equal(backup.usage.percent, 25);
  assert.equal(seafile.partitions[0].role, "seafile");
  assert.equal(fotos.transport, "nfs");
  assert.equal(fotos.share, "export/fotos");
  assert.equal(fotos.partitions[0].role, "data");
  assert.equal(fotos.partitions[0].roleName, "Fotos");
  assert.equal(fotos.usage, null); // sem statfs: aparece, sem uso

  // NAS nunca entra na limpeza
  assert.deepEqual(planDiskCleanup(backup, shares, {}, diskOfPath), []);
});

test("cada disco e partição ganha número, papel e nome próprio", () => {
  const disks = applyIdentity(buildDisksFromLsblk(lsblk, usage).concat(buildNetworkShares(procMounts, usage)), {
    "serial:50026B77": "SSD do servidor",
    "mount:/mnt/nas-backup": "Backup da loja"
  });
  const [sys, dois, um] = disks;
  assert.deepEqual(disks.filter(d => !d.network).map(d => d.index), [1, 2, 3, 1]); // o USB é "Externo 1"
  assert.equal(sys.customName, "SSD do servidor");
  assert.deepEqual(sys.partitions.map(p => p.role), ["efi", "system", "swap"]);
  assert.deepEqual(dois.partitions.map(p => p.role), ["seafile", "unmounted"]);
  assert.deepEqual([um.partitions[0].role, um.partitions[0].roleName], ["data", "Dados"]);
  const backup = disks.find(d => d.id === "nas-mnt-nas-backup");
  assert.equal(backup.index, 2); // NAS 2 (depois de /mnt/fotos antigas)
  assert.equal(backup.customName, "Backup da loja");
});

test("separa em físicos, externos (USB), NAS e nuvem", () => {
  const mounts = procMounts + "\n" + [
    "gdrive:Backups /mnt/google-drive fuse.rclone rw,nosuid 0 0",
    "https://nuvem.exemplo.com/remote.php/dav/files/ct /mnt/nextcloud davfs rw 0 0"
  ].join("\n");
  const disks = applyIdentity(buildDisksFromLsblk(lsblk, usage).concat(buildNetworkShares(mounts, usage)));
  const byGroup = group => disks.filter(d => d.group === group).map(d => d.partitions[0].mount || d.id);
  assert.deepEqual(byGroup("physical"), ["/boot/efi", "/srv/seafile-data", "/mnt/dados"]);
  assert.deepEqual(byGroup("external"), ["/run/media/sandro/TOSHIBA EXT"]);
  assert.deepEqual(byGroup("nas"), ["/mnt/fotos antigas", "/mnt/nas-backup", "/mnt/nas-seafile"]);
  assert.deepEqual(byGroup("cloud"), ["/mnt/google-drive", "/mnt/nextcloud"]);
  const gdrive = disks.find(d => d.partitions[0].mount === "/mnt/google-drive");
  assert.deepEqual([gdrive.kind, gdrive.server, gdrive.share, gdrive.transport], ["Nuvem", "gdrive", "Backups", "rclone"]);
  assert.equal(disks.find(d => d.partitions[0].mount === "/mnt/nextcloud").server, "nuvem.exemplo.com");
  // numeração por grupo: Disco 1..3, Externo 1, NAS 1..3, Nuvem 1..2
  assert.deepEqual(disks.filter(d => d.group === "physical").map(d => d.index), [1, 2, 3]);
  assert.equal(disks.find(d => d.group === "external").index, 1);
});
