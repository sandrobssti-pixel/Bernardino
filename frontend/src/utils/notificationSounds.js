import soundMp3 from "../assets/sound.mp3";
import chatNotifyMp3 from "../assets/chat_notify.mp3";

const SAMPLE_RATE = 44100;

const createWavDataUri = (notes) => {
  const totalDuration = notes.reduce((acc, note) => acc + note.duration, 0);
  const totalSamples = Math.floor(totalDuration * SAMPLE_RATE);
  const pcmBytes = totalSamples * 2;
  const buffer = new ArrayBuffer(44 + pcmBytes);
  const view = new DataView(buffer);

  const writeString = (offset, value) => {
    for (let i = 0; i < value.length; i += 1) {
      view.setUint8(offset + i, value.charCodeAt(i));
    }
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + pcmBytes, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, pcmBytes, true);

  let byteOffset = 44;
  notes.forEach((note) => {
    const noteSamples = Math.floor(note.duration * SAMPLE_RATE);
    for (let i = 0; i < noteSamples; i += 1) {
      let sample = 0;
      if (note.frequency > 0) {
        const envelope = 1 - i / noteSamples;
        sample = Math.sin((2 * Math.PI * note.frequency * i) / SAMPLE_RATE) * note.gain * envelope;
      }
      const intSample = Math.max(-1, Math.min(1, sample)) * 32767;
      view.setInt16(byteOffset, intSample, true);
      byteOffset += 2;
    }
  });

  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return `data:audio/wav;base64,${btoa(binary)}`;
};

const chatPingTone = createWavDataUri([
  { frequency: 820, duration: 0.07, gain: 0.26 },
  { frequency: 0, duration: 0.035, gain: 0 },
  { frequency: 960, duration: 0.1, gain: 0.3 },
]);

const chatBubbleTone = createWavDataUri([
  { frequency: 760, duration: 0.09, gain: 0.24 },
  { frequency: 0, duration: 0.03, gain: 0 },
  { frequency: 620, duration: 0.11, gain: 0.26 },
]);

const chatSoftTone = createWavDataUri([
  { frequency: 540, duration: 0.08, gain: 0.2 },
  { frequency: 680, duration: 0.08, gain: 0.22 },
  { frequency: 820, duration: 0.12, gain: 0.24 },
]);

export const SOUND_OPTIONS = [
  { id: "classic", label: "Padrão", src: soundMp3 },
  { id: "chat", label: "Chat suave", src: chatNotifyMp3 },
  { id: "chat_ping", label: "Chat ping", src: chatPingTone },
  { id: "chat_bubble", label: "Chat bubble", src: chatBubbleTone },
  { id: "chat_soft", label: "Chat soft", src: chatSoftTone },
];

export const SOUND_MAP = SOUND_OPTIONS.reduce((acc, option) => {
  acc[option.id] = option.src;
  return acc;
}, {});
