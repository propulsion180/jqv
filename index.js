#!/usr/bin/env node

/*
 * jqv is a TUI tool to be used to help developers when debugging jq filters
 */

const jq = require("jqjs.git/jq.js");
const fs = require("fs");
const tty = require("tty");
const blessed = require("blessed");
const { setTimeout } = require("timers");
const { json } = require("stream/consumers");
const hljs = require("highlight.js/lib/core");

//These variables are used to determine what to do at shutdown
let inputChanged = false;
let filterChanged = false;

//Parse the arguments and then start the UI
function main() {
  let [program, input, isTTY] = processArgs();

  if (isTTY) {
    //When input is being read from a file.
    setupTui(
      blessed.screen({
        smartCSR: true,
        title: "jqjs",
      }),
      program,
      input,
    );
  } else {
    //When input is being read from the STDIN.
    const fdIn = fs.openSync("/dev/tty", "r");
    const fdOut = fs.openSync("/dev/tty", "w");
    const termIn = new tty.ReadStream(fdIn);
    const termOut = new tty.WriteStream(fdOut);

    setupTui(
      blessed.screen({
        smartCSR: true,
        input: termIn,
        output: termOut,
        fullUnicode: true,
        mouse: true,
        keys: true,
        title: "jqjs",
      }),
      program,
      input,
    );
  }
}

//This gets all the arguments, input and filter. If the filter has arguments, they are filled in.
function processArgs() {
  let program = ".";
  let data = "";
  let isTTY = process.stdin.isTTY;

  if (!isTTY) {
    try {
      data = fs.readFileSync(0, "utf8");
    } catch (err) {
      console.error("Failed to get standard input", err);
      data = "None";
    }
  }
  let args = process.argv.slice(2);
  if (args.length == 0) {
    return [program, data, isTTY];
  }

  const programArgs = new Map();
  let a = false;
  let f = false;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--arg":
        programArgs.set(args[i + 1], args[i + 2]);
        a = true;
        i += 2;
        break;
      case "--from-file":
        program = fs.readFileSync(args[i + 1], "utf8");
        i++;
        f = true;
        break;
      default:
        if (!f) {
          program = args[i];
          f = true;
          break;
        } else {
          data = fs.readFileSync(args[i], "utf8");
          break;
        }
    }
  }

  if (a) {
    program = injectArgs(program, programArgs);
  }

  return [program, data, isTTY];
}

//fill filter with its arguments.
function injectArgs(program, varsMap) {
  let out = program;
  for (const [name, val] of varsMap.entries()) {
    const literal = JSON.stringify(val);
    const re = new RegExp(`\\$${name}\\b`, "g");
    out = out.replace(re, literal);
  }
  return out;
}

hljs.registerLanguage("json", require("highlight.js/lib/languages/json")); //Set the language for syntax highlighting.

//provides syntax highlighting for the json outputs.
function highlightJsonBlessed(src) {
  const html = hljs.highlight(src, {
    language: "json",
    ignoreIllegals: true,
  }).value; //Colors it but for html. So we must now convert some stuff.

  //Convert some simple stuff that usually occurs.
  let s = html
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");

  // convert highlight.js's colors to blessed color tags.
  s = s
    .replace(/<span class="hljs-string">/g, "{green-fg}")
    .replace(/<span class="hljs-number">/g, "{yellow-fg}")
    .replace(/<span class="hljs-literal">/g, "{cyan-fg}")
    .replace(/<span class="hljs-attr">/g, "{blue-fg}")
    .replace(/<\/span>/g, "{/}");

  // Worst case if there is any other html coloring done by highlight.js just remove it
  s = s.replace(/<\/?[^>]+>/g, "");

  return s;
}

//This function does the processing and outputs it to the output box.
function updateOutput(filterProg, input, screen, outputBox, errorBox) {
  outputBox.children.slice().forEach((child) => {
    if (child !== outputBox._label) child.destroy(); // Delete everything except the outputBox's _label.
  });
  outputBox.setContent("");
  outputBox.setScroll(0);
  errorBox.setContent("");
  outputBox.setLabel("Step Outputs [3]");
  screen.render();

  //Run jq.js with new data.
  let trace;
  try {
    const filter = jq.compile(filterProg);
    const jsonObj = JSON.parse(input);
    trace = filter.trace(jsonObj);
  } catch (e) {
    const msg = typeof e === "string" ? e : (e && e.message) || String(e);
    errorBox.setContent(msg);
    screen.render();
    return;
  }

  //Collapse tree's levels.
  const levels = collectLevels(trace);

  const root = trace;
  const spacing = 1;
  const xSize = 50;

  //The width each column needs to be to fit each output's text without wrapping.
  const widthArr = findBoxWidths(root);

  //Following section is used to calculate the height each box needs to be to fit all children within each of their parents.
  // Following three functions are left to simplify recursion.
  const heightMap = new Map();
  function computeHeight(node) {
    const ownH = computeBoxHeight(jq.prettyPrint(node.output), xSize);
    if (!node.next || node.next.length === 0) {
      heightMap.set(node, ownH);
      return ownH;
    }

    let childrenSum = 0;
    for (const child of node.next) {
      childrenSum += computeHeight(child) + spacing;
    }
    childrenSum -= spacing;
    const h = Math.max(ownH, childrenSum);
    heightMap.set(node, h);
    return h;
  }
  computeHeight(root);

  const topMap = new Map();
  function assignTops(node, top) {
    topMap.set(node, top);
    if (node.next && node.next.length) {
      let cur = top;
      for (const child of node.next) {
        assignTops(child, cur);
        cur += heightMap.get(child) + spacing;
      }
    }
  }
  assignTops(root, 0);

  const levelMap = new Map([[root, 0]]);
  (function markLevels(node) {
    const lvl = levelMap.get(node);
    if (node.next) {
      for (const child of node.next) {
        levelMap.set(child, lvl + 1);
        markLevels(child);
      }
    }
  })(root);

  const maxLevel = Math.max(...levelMap.values());
  const nodesByLevel = Array.from({ length: maxLevel + 1 }, () => []);
  for (const [node, lvl] of levelMap.entries()) {
    nodesByLevel[lvl].push(node);
  }

  //Go through each node and create a box in the position determined by information gathered earlier.
  let xOffset = 0;
  nodesByLevel.forEach((nodes, lvl) => {
    if (lvl === 0) return;
    for (const node of nodes) {
      const top = topMap.get(node);
      const height = heightMap.get(node);
      const raw = jq.prettyPrint(node.output); //pretty print
      const cont = highlightJsonBlessed(raw); //syntax highlighting
      const prelabel = node.node ? node.node.toString() : filterProg;
      const label = prelabel.substring(0, widthArr[lvl] - 4);

      const box = blessed.box({
        parent: outputBox,
        top,
        left: xOffset,
        width: widthArr[lvl],
        height,
        border: { type: "line" },
        scrollable: true,
        alwaysScroll: true,
        keys: true,
        wrap: true,
        tags: true,
        content: cont,
        label,
      });

      box._homeLeft = xOffset; //used for horizontal scrolling.
    }
    xOffset += widthArr[lvl] + 4;
  });

  screen.render();
}

//used to find the width each column needs to be to ensure that text can be shown without wrapping.
function findBoxWidths(root) {
  const toVisitQueue = [{ node: root, depth: 0 }];
  const levelWidths = [];

  while (toVisitQueue.length) {
    const currNode = toVisitQueue.shift();
    const maxWidth = longestLineWidth(jq.prettyPrint(currNode.node.output));
    if (
      levelWidths[currNode.depth] < maxWidth ||
      levelWidths[currNode.depth] == null
    ) {
      levelWidths[currNode.depth] = maxWidth;
    }
    if (currNode.node.next && currNode.node.next.length) {
      for (const n of currNode.node.next) {
        toVisitQueue.push({ node: n, depth: currNode.depth + 1 });
      }
    }
  }
  return levelWidths;
}

//Get the longest line in a piece of text.
function longestLineWidth(text) {
  const s = String(text);
  let max = 0;

  for (const line of s.split("\n")) {
    let cols = 0;
    for (const ch of line.split("")) {
      if (ch === " ") {
        cols += 1;
      } else {
        cols += blessed.unicode.strWidth(ch);
      }
    }
    if (cols > max) max = cols;
  }
  return max + 3;
}

//calculates the height a box should be.
function computeBoxHeight(text, boxCols) {
  const contentLines = text.split("\n");
  let rows = 0;
  for (let line of contentLines) {
    rows += Math.max(1, Math.ceil(line.length / boxCols));
  }
  return rows + 2;
}

//walks the output tree of jqjs and returns all nodes.
function collectLevels(root) {
  const levels = [];
  let current = [root];
  while (current.length) {
    levels.push(current);
    const next = [];
    for (let node of current) {
      if (node.next && node.next.length) next.push(...node.next);
    }
    current = next;
  }
  return levels;
}

//When a program ends it will save any JSON or filter modifications and then print the output to STDOUT.
function endProgram(program, jsonIn, screen) {
  try {
    if (filterChanged) {
      fs.writeFileSync("newFilter.jq", program, "utf8");
    }
    if (inputChanged) {
      fs.writeFileSync("newInput.json", jsonIn, "utf8");
    }
  } catch (err) {
    console.error("Error writing file: ", err);
  }

  try {
    screen.leave && screen.leave();
  } catch {}
  try {
    screen.destroy && screen.destroy();
  } catch {}

  try {
    const filter = jq.compile(program);
    const obj = JSON.parse(jsonIn);
    const results = Array.from(filter(obj));

    process.stdout.write(jq.prettyPrint(results));
  } catch (e) {}

  process.exit(0);
}

//sets up the Text based user interface
function setupTui(screen, program, input) {
  const filterInput = blessed.textbox({
    label: " Filter [1] ",
    top: 0,
    left: "20%",
    width: "80%",
    height: "10%",
    border: {
      type: "line",
    },
    inputOnFocus: true,
    keys: true,
    mouse: true,
    value: program,
  });

  const jsonInput = blessed.textarea({
    label: " JSON Input [2] ",
    top: 0,
    left: 0,
    width: "20%",
    height: "100%",
    border: {
      type: "line",
    },
    wrap: false,
    inputOnFocus: true,
    keys: true,
    value: jq.prettyPrint(JSON.parse(input)),
    scrollable: true,
    scrollbar: {
      ch: " ",
      track: { bg: "grey" },
      style: { inverse: true },
      orientation: "horizontal",
    },
  });

  jsonInput.key("C-s", (value) => {
    jsonInput.emit("submit");
  });

  jsonInput.on("click", () => outputBox.focus());
  jsonInput.removeAllListeners("wheelup");
  jsonInput.removeAllListeners("wheeldown");
  jsonInput.key("up", () => {
    jsonInput.scroll(-1);
    screen.render();
  });
  jsonInput.key("down", () => {
    jsonInput.scroll(1);
    screen.render();
  });

  const outputBox = blessed.box({
    label: " Step Outputs [3] ",
    top: "10%",
    left: "20%",
    width: "80%",
    height: "80%",
    border: { type: "line" },
    scrollable: true,
    alwaysScroll: true,
    keys: true,
    vi: true,
    mouse: true,
    wrap: false,
  });

  const errorBox = blessed.box({
    label: " Error Output ",
    top: "90%",
    left: "20%",
    width: "80%",
    height: "10%",
    border: { type: "line" },
    keys: true,
    mouse: true,
    value: "Error Box",
  });

  filterInput.on("submit", () => {
    setTimeout(() => {
      filterChanged = true;
      const filterProg = filterInput.getValue();
      updateOutput(filterProg, input, screen, outputBox, errorBox);
      screen.render();
    }, 50);
  });
  jsonInput.on("submit", () => {
    setTimeout(() => {
      inputChanged = true;
      const jsIn = jsonInput.getValue();
      updateOutput(program, jsIn, screen, outputBox, errorBox);
      screen.render();
    }, 50);
  });

  //following variable and two keybinds are used to scroll horizontally in the output box.
  let hOffset = 0;

  outputBox.key(["right"], () => {
    hOffset = Math.max(0, hOffset - 5);
    for (const child of outputBox.children) {
      child.left = child._homeLeft - hOffset;
    }
    screen.render();
  });

  outputBox.key(["left"], () => {
    hOffset += 5;
    for (const child of outputBox.children) {
      child.left = child._homeLeft - hOffset;
    }
    screen.render();
  });

  screen.key("1", () => {
    filterInput.focus();
  });
  screen.key("2", () => {
    jsonInput.focus();
  });
  screen.key("3", () => {
    outputBox.focus();
  });

  screen.append(jsonInput);
  screen.append(filterInput);
  screen.append(outputBox);
  screen.append(errorBox);
  filterInput.focus();
  updateOutput(program, input, screen, outputBox, errorBox);
  screen.render();
  screen.key(["C-c", "q"], () =>
    endProgram(filterInput.getValue(), jsonInput.getValue(), screen),
  );
}

main();
