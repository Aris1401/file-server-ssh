var term = new Terminal();
term.open(document.getElementById('terminal'));

var currentInput = ''

async function sendCommandToAPI(command) {
    try {
        const response = await fetch('/api/exec', {  // Replace with your API endpoint
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ command: command })
        });
        
        const result = await response.json(); // Assuming the response is JSON
        let formattedResult = ""
        if (result.success == false) {
          formattedResult = result.error
              .replace(/<br>/g, '\n')               
              .replace(/&nbsp;/g, ' ')             
              .replace(/&nbsp;&nbsp;&nbsp;&nbsp;/g, '\t');
        } else {
          formattedResult = result.result
              .replace(/<br>/g, '\n')               
              .replace(/&nbsp;/g, ' ')             
              .replace(/&nbsp;&nbsp;&nbsp;&nbsp;/g, '\t');
        }

        
        const lines = formattedResult.split(/\n/);
        lines.forEach((l) => term.write('\r\n' + l + '\r\n'));
    } catch (error) {
        term.write('\r\nError executing command: ' + error.message + '\r\n');
    }
}

let lineBuffer = [];
let history = [];
let history_entry = ""
let shellListener = null;

async function simpleShell(data) {
  // string splitting is needed to also handle multichar input (eg. from copy)
  for (let i = 0; i < data.length; ++i) {
    const c = data[i];
    if (c === '\r') {  // <Enter> was pressed case
      term.write('\r\n');
      if (lineBuffer.length) {
        // we have something in line buffer, normally a shell does its REPL logic here
        // for simplicity - just join characters and exec...
        const command = lineBuffer.join('');
        lineBuffer.length = 0;
        history.push(command);
        try {
          // tricky part: for interactive sub commands you have to detach the shell listener
          // temporarily, and re-attach after the command was finished
          shellListener?.dispose();
          await sendCommandToAPI(command);  // issue: cannot force-kill in JS (needs to be a good citizen)
        } catch (e) {
          // we have no real process separation with STDERR
          // simply catch any error and output in red
          const msg = !e ? 'Unknown Error...' : e.message || e;
          term.write(`\x1b[31m${msg.replace('\n', '\r\n')}\x1b[m`);
        } finally {
          // in any case re-attach shell
          shellListener = term.onData(simpleShell);
        }
        term.write('\r\n');
      }
      term.write(`${ domainName } group${ groupName } $ `);
    } else if (c === '\x7F') {  // <Backspace> was pressed case
      if (lineBuffer.length) {
        // dont delete prompt
        // this is still wrong for multiline inputs!
        lineBuffer.pop();
        term.write('\b \b');
      }
    } else if (['\x1b[A', '\x1b[B', '\x1b[C', '\x1b[D'].includes(data.slice(i, i + 3))) {  // <arrow> keys pressed
      if (data.slice(i, i + 3) === '\x1b[A') {
        // UP pressed, select backwards from history + erase terminal line + write history entry
        term.write('\x1b[2KSimpleShell> ' + history_entry);
      } else if (data.slice(i, i + 3) === '\x1b[B') {
        // UP pressed, select forward from history + erase terminal line + write history entry
        term.write('\x1b[2KSimpleShell> ' + history_entry);
      }
      // <LEFT> <RIGHT> skipped, since no inline editing implemented
      i += 2;
    } else {  // push everything else into the line buffer and echo back to user
      lineBuffer.push(c);
      term.write(c);
    }
  }
}

// shell startup
shellListener = term.onData(simpleShell);
term.write(`${ domainName } group${ groupName } $ `);