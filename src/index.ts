import * as readline from "readline";
import { runAgent } from "./agent.js";
const rl = readline.createInterface({
  input: process.stdin,  
  output: process.stdout, 
});

function askUser(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer);
    });
  });
}



async function main() {
  console.log("Agent ready. Type your message. Press Ctrl+C to exit.\n");

  while (true) {
    const userInput = await askUser("You: ");


    if (!userInput.trim()) continue;


    if (userInput.trim() === "exit" || userInput.trim() === "quit") {
      console.log("Goodbye.");
      rl.close();
      break;
    }

    try {
      console.log("\nAgent is thinking...\n");
      const reply = await runAgent(userInput);

      console.log(`Agent: ${reply}\n`);
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error(`Error: ${error.message}`);
      }
    }
  }
}


main();