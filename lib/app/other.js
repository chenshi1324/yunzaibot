import { segment } from "oicq";

const _path = process.cwd().trim("\\lib");

function help(e) {
  e.reply(segment.image(`file://${_path}/resources/help/help.png`));
  return true;
}

export { help };