# Using the app

A walk through the window, panel by panel, in the order they appear on screen.

## Opening and closing it

Start SwMacroFlow from the Start menu. It opens on a connection panel while it looks for SOLIDWORKS:
it joins one that is already running, or starts one if none is - which can take a couple of minutes
from cold. The rest of the window appears once there is a session behind it.

If it cannot connect it says why and offers **Try again**. The usual cause is that one of the two is
running as administrator and the other is not; start both the same way. See *Troubleshooting*.

SOLIDWORKS stays usable while SwMacroFlow is open - they are separate programs, and neither blocks
the other.

If the session drops, Run stays disabled until you connect again. The reason next to the button then
reads *Connect to a SOLIDWORKS instance first — pick one in the header.*

Closing the window closes SwMacroFlow, and with it everything you had set up: the macros, the files,
the inputs, the results. It asks first if a batch is still running. If SwMacroFlow started SOLIDWORKS
itself, it closes that too; if you had SOLIDWORKS open already, it is left exactly as it was. Use
**Reset** when you want a clean slate without closing anything.

## The header

Buttons top right (and the connection / instance controls when they apply):

| Control | What it does |
|---|---|
| **?** | Opens this help page in your browser. It is rebuilt each time you click. |
| **Reset** (circular arrow) | Clears the macros, the file list, the inputs, the results and the log, and puts the scope checkboxes back to their defaults. It asks first if there is anything to lose, and is disabled while a batch is running. |
| **Sun / moon** | Switches between the light and dark theme. The choice is remembered. |
| Instance / connection | When SOLIDWORKS must be chosen or reconnected, pick it here. |

## MACROS

There are three ways to add a macro, and they behave identically:

- **Add Macro...** browses for a `.swp`. Select several at once and they all join the chain, in the
  order the dialog lists them.
- **From Library** drops down the macros that ship with SwMacroFlow - pick one and it is added
  without browsing.
- **Drag a `.swp`** from File Explorer onto the window. Drop several together, or mix them with
  SOLIDWORKS files and each goes where it belongs.

None of them needs a connection. If SOLIDWORKS is not connected yet, SwMacroFlow reads the macro
file directly so you can fill in its inputs. It is checked through SOLIDWORKS before it can run: the
check happens by itself the moment you connect, and anything you typed in the meantime is kept.
Disconnecting drops the check, so reconnecting - perhaps to a different SOLIDWORKS - runs it again.

The library is the folder `%LOCALAPPDATA%\SwMacroFlow\macros`. Dropping a `.swp` there yourself makes
it appear in **From Library** the next time you open the menu - no restart required. (If that folder
cannot be written, the app falls back to the install copy for listing only.)

The **folder** button beside **From Library** opens that folder in File Explorer, so you can drop a
macro in without going looking for the path. It works whether or not the library has anything in it
yet, and creates the folder the first time if it is not there.

Each row in the list has:

- A **checkbox**. Unticking leaves the macro out of this run *without* discarding its inputs. Untick
  it, run, tick it again later and everything you typed is still there.
- **↑** and **↓** to change the order. Reordering does not disturb the values you have typed.
- **✕** to remove the macro from the chain, along with its inputs.
- A **!** glyph when something is wrong with it. Hover for the reason.

Below the list: **Keep running the other macros if one fails on a file** - see *When a macro fails*
below.

**The list order is the run order.** The same macro can be added twice: exporting as STEP and then
again as PDF is one macro with two sets of inputs, so add it twice and give each row different
values.

## INPUTS

Click a macro in the list to see its inputs. The panel shows **one macro at a time** and names which
one at the top. The section hides itself when the selected macro declares none.

Inputs are declared inside the macro itself - see *Adding inputs*. SwMacroFlow reads them when the
macro loads and builds a matching control:

| Declared type | Control |
|---|---|
| `String` | Text box |
| `Integer` | Text box that only accepts a whole number |
| `Bool` | Checkbox |
| `FilePath` | Text box with a **...** file picker |
| `FolderPath` | Text box with a **...** folder picker |
| `Option` | Dropdown |

**Inputs never leak between macros.** Two macros that both declare `@Name` each get their own value.

### Property placeholders in values

On `String`, `FilePath` and `FolderPath` fields you may type `{PropertyName}` mixed with ordinary
text - for example `{PartNumber}_{Revision}.pdf`. Those tokens are highlighted magenta as you type.

They are resolved **per document** when that file runs, from the open document's custom properties
(active configuration first, then file-level). A missing property fails that file with a red row; it
does not expand to empty. Integer, Bool and Option fields do not take property tokens.

`{Title}` is the one reserved name - it always resolves to the document's filename, not a custom
property. Full rules are in *Adding inputs*.

Do not use `{Property}` values when **Run once without opening any files** is ticked - there is no
document to resolve against. Full rules are in *Adding inputs*.

### Validation

Inputs are validated **before** the run starts, on purpose. A mistyped template path would otherwise
fail every file in the batch, one slow open-and-close at a time.

- Blank is always allowed.
- A non-blank number must parse.
- A non-blank `FilePath` must exist, unless it contains `{Property}` tokens (then only brace syntax
  is checked).
- A `FolderPath` need not exist - macros often create it.
- Malformed braces in a free-text value block Run.

## SCOPE

Four ways to put files in scope:

- **Browse Folder...** scans a folder. **Include subfolders** decides how deep (off by default).
- **Add Files...** picks individual files.
- **Drag and drop** files or folders onto the panel.
- **Remove Selected**, or the Delete key, takes them out again.

Only `.sldprt`, `.sldasm` and `.slddrw` are recognised.

Files land in three lists - Part, Assembly and Drawing - each with its own checkbox. **The checkbox
filters what actually runs.** A file in an unticked list is still in your list; it is just not in
scope for this run.

### Run once without opening any files

Tick this when the macros do not act on a file you hand them.

- The chain runs a single time. One row per macro, titled with the macro rather than a file.
- The Part / Assembly / Drawing checkboxes clear and grey out, along with Browse Folder, Add Files,
  Remove Selected, Include subfolders and drag-and-drop. Nothing on screen offers you a scope the
  run would ignore.
- Your file list is not thrown away. Untick the box and it comes back, with the type checkboxes
  exactly as you left them.
- Inputs, validation and reporting all work exactly the same - except `{Property}` placeholders
  cannot resolve without a document.
- The skip rule still applies: a chain is a chain whether or not a document is involved.

Your macro must not rely on `ActiveDoc` in this mode - there is no active document, so it will be
`Nothing`.

## When a macro fails on a file

By default the macros after it are **skipped for that file**, and the batch moves to the next file.
Their rows say so, and name the macro that stopped them. The next file starts the chain clean.

That is usually what you want. An order you arranged tends to mean a dependency - the second macro
reads what the first one set - and closing a document discards unsaved changes, so stopping throws
away a half-finished edit rather than letting a later macro save one.

Tick **Keep running the other macros if one fails on a file** when your macros happen to share a
document but not a purpose, and each should get its turn regardless.

A macro that merely opened a prompt (an amber row) does **not** stop the chain. Only a real failure
does.

## Running, and stopping

**Run Batch** starts the job. In run-once mode the button reads **Run Once** instead.

The window stays responsive while it runs - the batch happens on its own thread, so the results and
the log fill in live and every button keeps working. **Cancel** stops the run after the macro in
progress finishes - never mid-macro, so nothing is left half-written. You do not have to wait out the
rest of a file's chain. `Ctrl+Shift+Q` does the same thing when the SwMacroFlow window has focus.

A big batch is bounded by how fast SOLIDWORKS opens and closes documents, not by SwMacroFlow.

## RESULTS

Every macro-file pair gets exactly one row, showing the **most severe** thing that macro reported
for that file:

| Row | Meaning |
|---|---|
| Green | The macro ran and reported nothing worse than a status message. |
| Amber | The macro opened a prompt. Nobody was there to click, so the batch answered it - see *Reporting a result*. |
| Red | The macro reported a failure, crashed, a `{Property}` could not be resolved, or the file could not be opened. |
| Grey | The macro never ran on this file, because an earlier one in the chain failed on it. |

Each row carries the macro name under the file name, so a chain's rows can be told apart. The list
scrolls to the newest row as the batch runs.

## LOG

The log panel is collapsible and shows **every** message, not just the one that made it onto the
row, in the order they happened. It keeps the last 500 lines on screen.

- **Copy** puts the whole visible log on the clipboard.
- **Clear** empties the panel. It does not touch the file on disk.
- The folder at the bottom of the panel is where the log files are written, one per day, named
  `logger_<date>.log`. Thirty days are kept. Normally a `logs` folder beside the executable; if that
  is not writable, `%LOCALAPPDATA%\SwMacroFlow\logs`.

## When Run is greyed out

The reason is written next to the button. It is always one of these:

| Message | Fix |
|---|---|
| Connect to a SOLIDWORKS instance first — pick one in the header. | There is no session yet, or it was lost. Connect or pick an instance. |
| Add at least one macro to run. | The list is empty. |
| Tick at least one macro to run. | Every macro is unticked. |
| A macro's own error message | A ticked macro did not load cleanly. Its row carries a **!** you can hover. See *Troubleshooting*. |
| Add at least one file to the scope. | Nothing resolves - check the Part / Assembly / Drawing boxes as well as the lists. Never applies in run-once mode. |
| Enter a valid whole number for every number input in *macro*. | A number input will not parse. The message names the macro, because that macro's inputs may not be the ones on screen. |
| Fix every property placeholder in *macro*. | A free-text input has malformed `{…}` braces. |
| Choose a file that exists for every file input in *macro*. | A file input points at something that is not there (and has no `{Property}` tokens). |

A `FolderPath` that does not exist yet does **not** block Run - macros commonly create it.
