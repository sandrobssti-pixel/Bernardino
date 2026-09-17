import { messages as portugueseMessages } from "./pt";
import { messages as englishMessages } from "./en";
import { messages as spanishMessages } from "./es";
import { messages as spanishSpainMessages } from "./esES"; // ✅ Espanhol (Espanha) — mesmo conteúdo do es.js (Paraguai) por enquanto

const messages = {
	...portugueseMessages,
	...englishMessages,
	...spanishMessages,
	...spanishSpainMessages,
};

export { messages };
