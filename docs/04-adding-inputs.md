# Adding inputs

An input is a value the user fills in before the run. You declare it in the macro; SwMacroFlow builds
the control, validates what is typed, and substitutes the value into your code before it runs.

Declare one `Const` per input, valued with an `"@Name"` token, and describe it in the comment tail.
Declarations work in **any standard module**.

```vb
Const SheetName    As String = "@SheetName"    'Type: String     'Tooltip: "Sheet to activate"   'Value: "Sheet1"
Const Quantity     As String = "@Quantity"     'Type: Integer    'Tooltip: "How many"            'Value: 1
Const DryRun       As String = "@DryRun"       'Type: Bool       'Tooltip: "Report only"         'Value: True
Const TemplatePath As String = "@TemplatePath" 'Type: FilePath   'Value: ""    'Filter: ".drwdot"
Const ExportFolder As String = "@ExportFolder" 'Type: FolderPath 'Value: "C:\Temp"
Const Mode         As String = "@Mode"         'Type: Option     'Value: "PDF" 'Options: PDF, DXF, STEP
Const OutputName   As String = "@OutputName"   'Type: String     'Tooltip: "File name pattern"   'Value: "{PartNumber}_{Revision}.pdf"
```

Then just use them:

```vb
model.Extension.SaveAs ExportFolder & "\" & OutputName, 0, 0, Nothing, 0, 0
```

No helper code, no reading a settings file. The form labels each field with the name minus its `@`,
so `"@SheetName"` shows as **SheetName**. The Const identifier is what your VBA reads; the label
comes from the token.

## The shape of a declaration

```
Const <Name> As String = "@<Token>"   '<Key>: <value>   '<Key>: <value>
```

- `Const` at the start of the line, optionally indented.
- `As String` - required, on every input. See *Everything arrives as a string* below.
- The token is the **entire** string literal: `"@Token"`, nothing else inside the quotes.
- The metadata is a normal VBA comment tail. Keys are separated by `'`, and each runs until the next
  `'` that actually introduces a key - so an apostrophe inside a tooltip is data, not a delimiter.

## The metadata keys

All optional, all case-insensitive, and unknown keys are ignored.

| Key | Applies to | Meaning |
|---|---|---|
| `Type:` | all | Which control to build. `String` if omitted. |
| `Tooltip:` | all | Hover text for the field. |
| `Value:` | all | The default the form starts with - **always** a default, never a filter. |
| `Filter:` | `FilePath` | Extensions the picker narrows to, e.g. `".sldprt, .sldasm"`. |
| `Options:` | `Option` | The dropdown's choices, comma-separated. |

Quotes around a metadata value are optional: `'Value: 1` and `'Value: "C:\Temp"` both work.

## The types

| `Type:` | Also accepted | Control | What your macro receives |
|---|---|---|---|
| `String` | anything unrecognised | Text box | What was typed |
| `Integer` | `Int` | Text box that only accepts a whole number | The digits, as text - use `CInt()` |
| `Bool` | `Boolean` | Checkbox | `"True"` or `"False"`, as text |
| `FilePath` | | Text box plus a file picker | The full path |
| `FolderPath` | | Text box plus a folder picker | The full path |
| `Option` | `Dropdown` | Dropdown | The chosen item's **text**, never an index |

An `Option` whose `Value:` is not one of its own `Options:` is reported as a warning, and the first
option is selected instead.

## Rules worth knowing

- **Everything arrives as a string.** A token can only live inside a string literal, so
  `Const Q As Integer = "@Quantity"` is a VBA type mismatch and fails the load check. Convert where
  you need to: `CInt(Quantity)`.
- **Blank is always allowed** and substitutes an empty string. Guard for it:
  `If Len(Quantity) > 0 Then count = CInt(Quantity)`.
- **A `Bool` is the text `"True"` or `"False"`.** Compare against the text - `If DryRun = "True"
  Then` - not with `If DryRun Then`.
- **Only a declaration creates a field.** Using `"@SheetName"` elsewhere still substitutes, but will
  not add a second control - which is why a misspelled `"@SheetNam"` is reported as a warning
  instead of silently becoming its own text box.
- **The token must be the whole literal.** `"bob@example.com"` and `"C:\out\@name.txt"` are left
  alone. Tokens inside a `'` or `Rem` comment are ignored, so commented-out code raises no phantom
  fields.
- **Declaring the same token twice gives you one field** that fills in both. Useful when two modules
  each need the value.
- **Inputs are per macro row.** Two macros that both declare `@Name` each get their own value, and
  the same macro added twice gets two independent sets.

## Validation before Run

SwMacroFlow checks inputs **before** the batch starts, so a bad value does not fail every file one
slow open at a time. Blank is always legal. What blocks Run:

| Input | Rule |
|---|---|
| `Integer` | Non-blank value must parse as a whole number. |
| `FilePath` | Non-blank value must exist on disk, **unless** it contains `{Property}` tokens (see below) - then only the brace syntax is checked. |
| `FolderPath` | **Not** existence-checked. Macros commonly create the folder with `MkDir`. |
| `String` / `FilePath` / `FolderPath` with braces | Every `{…}` must be well-formed (see *Property placeholders*). |
| `Bool`, `Option` | Cannot be invalid - the control only produces legal values. |

The Run button names the macro at fault, because its inputs may not be the ones on screen:

- *Enter a valid whole number for every number input in …*
- *Fix every property placeholder in …*
- *Choose a file that exists for every file input in …*

## Property placeholders

A `String`, `FilePath`, or `FolderPath` value may mix literal text with `{PropertyName}` tokens -
for example `{PartNumber}_{Revision}.pdf`. Type them in the Inputs panel; they are highlighted
magenta as you type. Braces are reserved for this syntax in those three types - there is no escape
in v1.

Integer, Bool, and Option inputs stay literal. They never resolve property tokens.

### How they differ from `@Name`

| | `"@Name"` token | `{Property}` placeholder |
|---|---|---|
| Where | Declared in the macro source | Typed into an input **value** |
| When resolved | Before the batch, baked into the temp copy | **Per document** while that file's macro runs |
| Against what | The text the user entered | Custom properties of the open document |

### Resolution order

Against the document that is open when the macro runs:

1. Active configuration's properties first
2. Then file-level custom properties

Lookup is case-insensitive and uses the **resolved** value, so an expression property such as
`SW-Mass` becomes the evaluated number, not the expression text.

### `{FileName}` is reserved

`{FileName}` always resolves to the open document's filename with its extension stripped -
`Part1.SLDPRT` becomes `Part1`. It is checked before the lookup above and never falls through to
a custom property, even one literally named `FileName`. It fails the same way any `{Property}` does
when no document is open, but it can never fail as "missing" - there is nothing to look up.

Like every other token name it is matched case-insensitively, so `{FileName}`, `{filename}` and
`{FILENAME}` are the same token.

**Renamed - this placeholder used to be `{Title}`.** `{Title}` is no longer reserved: it now reads
an ordinary custom property called *Title*, like any other name. Update any saved job that still
uses it, or that job will pick up the document's *Title* property instead of its filename - or fail
that file as a missing property if the document has none.

### What can go wrong

| Situation | Result |
|---|---|
| Property found | The token is replaced with the resolved value; your Const holds ordinary text. |
| Property missing from both stores | That file **fails** with a named error. The batch continues. It does **not** expand to empty. |
| No document open (run-once mode, or open failed) | That run **fails** - there is nothing to resolve against. |
| Malformed braces (`a{b`, `{}`, nested `{a{b}}`) | Run is blocked before the batch starts. |

Do not rely on `{Property}` in a macro that only runs in **Run once without opening any files** -
there is no active document.

### Example

Declare a String input with a property-based default:

```vb
Const OutputName As String = "@OutputName" 'Type: String 'Value: "{PartNumber}_{Revision}.pdf"
```

The user can keep that default or edit it. On each drawing or part, SwMacroFlow expands the tokens
from that document's properties, then your macro sees a concrete name such as `BR-100_A.pdf`.

For a full contract in one pasteable document, see *Macro authoring spec*.
