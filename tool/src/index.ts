import { TobichiExtractor } from "./tobichi-extractor";

new TobichiExtractor().exec().then(x => {
  console.log('command executed.');
});
