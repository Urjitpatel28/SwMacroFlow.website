# Using the Copilot

The Copilot is a chat panel that answers questions about SwMacroFlow and SOLIDWORKS VBA, and - if
you let it - writes and edits macros in your library, builds the chain, changes the scope and starts
a run.

It does nothing until you give it an API key, and sends nothing anywhere before then.

## Opening and closing it

The **AI Copilot** button sits in the header beside **Help**, **Reset** and **Settings**. The panel
opens where **RESULTS** and **LOG** were; closing it puts them back.

**Closing the panel ends the conversation.** Opening it again starts a fresh one. That is on
purpose: the Copilot reasons about the panel as it is right now, and a conversation that outlived
three different chains would be answering about a setup that no longer exists. Conversations are
saved as you have them, so an old one can still be read from **Chat history** - it is the live
session that ends, not the record of it.

## Turning it on

Everything is under **Settings → Copilot**:

| Field | What it is |
|---|---|
| **PROVIDER** | OpenAI, Anthropic, xAI, Gemini or LM Studio. |
| **API KEY** | Your key for that provider. Stored encrypted for your Windows account only, and never written to the log. Clear the box to remove it. |
| **BASE URL** | Leave blank to use the provider's own endpoint. |
| **MODEL** | The model name that provider expects. |

Press **Save**.

**LM Studio is the local one** - a model running on your own machine, so nothing leaves it. The
other four are somebody else's servers. See *What leaves the machine* in *Using the app* before you
put a key in.

## Modes

The mode decides how much the Copilot may do without asking. Use the **Mode** button by the message
box, or press **Shift+Tab** in the message box to step through them.

| Mode | What it does |
|---|---|
| **Ask** | Answers questions and can look things up. Changes nothing. |
| **Plan** | Looks around and proposes a plan. Changes nothing until you switch mode. |
| **Manual** | Asks before every change that needs approval. |
| **Edit automatically** | Writes and edits macros without asking. Still asks before scope changes, restores and runs. |
| **Auto** | Edits macros and changes the scope without asking. Still asks before running or scheduling a batch. |

**Manual is the default**, on a fresh install and whenever a saved mode cannot be read.

In **Ask** and **Plan** the tools that change anything are not offered to the model at all - not
only the ones that would raise a card, but the panel ones too. It cannot quietly build a chain and
then describe it as a proposal.

**No mode approves a run.** Not **Auto**, and not any mode added later. A batch closes the documents
you have open and discards unsaved work, and a schedule does the same with nobody at the keyboard,
so running, running a schedule now and scheduling a batch always ask. **Auto** means *stop asking me
about the setup*, not *stop asking me before you touch my files*.

Turning the mode up never removes the app's own checks either. Ask for a run with nothing ticked and
it is refused in **Auto** exactly as it is in **Manual**.

## Approval

When the Copilot wants to do something gated, an **Approval needed** card appears in the transcript
with **Decline** and **Approve**. Declining is an answer rather than an error - the model is told
you said no, and carries on from there.

What raises a card, by mode:

| Action | Manual | Edit automatically | Auto |
|---|---|---|---|
| Write or edit a macro | Card | Goes ahead | Goes ahead |
| Scan a folder, add files, restore a session or a schedule | Card | Card | Goes ahead |
| Run, run a schedule now, schedule a batch | Card | Card | Card |

Everything else - reading, and the panel changes that can only make a run smaller or leave it the
same size - never raises a card in any acting mode.

In the two automatic modes the Copilot is told to say what it is about to do before it does it, so
you get a sentence instead of a card. That is a smaller thing than an approval. It is worth reading.

## What it can see

The reading tools are available in every mode, **Ask** included: the macro library and the current
chain, a macro's source, the files in scope, the last results, the log, your settings, the scheduled
batches, the saved workflows, and these help guides.

That list is also what can end up in a request to your provider. Whatever it reads while answering
is sent.

## Macros in a reply

A code block in a reply is marked **VBA only** and has two buttons:

- **Save** writes it into the library as a `.swp` - the same
  `%LOCALAPPDATA%\SwMacroFlow\macros` folder that **From Library** reads.
- **Copy** puts the code on the clipboard.

A macro the Copilot writes is a macro like any other. It still has to compile, it still needs its
inputs declared, and it is still worth reading before you run it over four hundred files.

## Attachments

The attach button takes an image, PDF, Word or text file, and you can paste one straight into the
message box instead.

## Chat history

**Chat history** lists your conversations; they are saved as you have them. A row can be renamed or
deleted - **Delete this chat** removes it for good. Before you have had any, the list says *No saved
chats yet.*

They are files in `%LOCALAPPDATA%\SwMacroFlow\chats`.

## Changing something you already sent

A message you sent can be edited: change the text and send it again, and **Previous version** and
**Next version** step between the answers you have had to it.

## Commands

Four things are handled by the app itself and never sent to the model:

| Type | Does |
|---|---|
| `/clear` | Clears the transcript. |
| `/theme` | Switches between light and dark. |
| `/dark` | Switches to dark. |
| `/light` | Switches to light. |

A short phrase that plainly means one of those - *switch to dark mode* - is handled the same way. A
question about themes is not; that goes to the model like anything else. Any other `/something` is
sent as ordinary text.
