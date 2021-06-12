---
title: Jupter integration with the Language Server Protocol
authors: Nicholas Bollweg, Michał Krassowski
issue-number: 67
pr-number: <proposal-pull-request-number>
date-started: 2021-06-dd
---

# Summary

> One paragraph explanation of the proposal.

[jupyter(lab)-lsp](https://github.com/krassowski/jupyterlab-lsp) is a project bringing integration of language-specific IDE features (such as diagnostics, linting, autocompletion, refactoring) to the Jupyter ecosystem by leveraging the established [Language Server Protocol](https://langserver.org) (LSP). We would like to propose its incorporation as an official sub-project of Project Jupyter. We feel this would benefit Jupyter users through better discoverability of advanced interactive computing features, supported by the  (LSP), but otherwise missing in a user's Jupyter experience. While our repository currently features a working implementation, the proposal is not tied to it (beyond a proposal for migration of the repository to a Jupyter-managed GitHub organization) but rather aimed to guide the process of formalizing and evolving the way of integrating Jupyter with LSP in general.

# Motivation

> Why are we doing this? What use cases does it support? What is the expected outcome?

A common criticism of the Jupyter environment (regardless of the front-end editor) and of the official Jupyter frontends (in light of recent, experimental support of feature-reich notebook edition under developement by some of the major IDE developers) is the lack of advanced code assistance tooling. The proper tooling can improve code quality, validity of computation and increase developement speed and we therefore belive that it is a key ingredient of a good computational notebooks environment, which from teh beginning aimed at improving the workflow of users.

Providing support for advanced coding assistance for each language separatly is a daunting task, challenging not only for volunteer-driven projects, but also for large companies. Microsoft recognised the problem creating the Language Server Protocol with reference implementation in VSCode(TM).

- many language servers are community supported and available for free.

# Guide-level explanation

> Explain the proposal as if it was already implemented and you were
> explaining it to another community member. That generally means:
> 
> - Introducing new named concepts.
> - Adding examples for how this proposal affects people's experience.
> - Explaining how others should *think* about the feature, and how it should impact the experience using Jupyter tools. It should explain the impact as concretely as possible.
> - If applicable, provide sample error messages, deprecation warnings, or migration guidance.
> - If applicable, describe the differences between teaching this to existing Jupyter members and new Jupyter members.
> 
> For implementation-oriented JEPs, this section should focus on how other Jupyter
> developers should think about the change, and give examples of its concrete impact. For policy JEPs, this section should provide an example-driven introduction to the policy, and explain its impact in concrete terms.

Much like [Jupyter Kernel Messaging](https://jupyter-client.readthedocs.io/en/stable/messaging.html), LSP provides a language-agnostic, JSON-compatible description for multiple clients to integrate with any number of language implementations. Unlike Kernel Messaging, the focus is on precise definition of the many facets of static analysis and code transformation, with nearly four times the number of messages of the Jupyter specification. We will discuss the opportunities and challenges of this complexity for users and maintainers of Jupyter Clients, Kernels, and related tools.

The key component of the repository, [@krassowski/jupyterlab-lsp](https://www.npmjs.com/package/@krassowski/jupyterlab-lsp), offers Jupyter users an expanded subset of features described by the LSP as an extension to JupyterLab. These features include refinements of existing Jupyter interactive computing features, such as completion and introspection, as well as new Jupyter features such as linting, reference linking, and symbol renaming. It is supported by [jupyter-lsp](https://pypi.org/project/jupyter-lsp/), a Language Server- and Jupyter Client-agnostic extension of the Jupyter Notebook Server (for the `0.x` line) and Jupyter Server (for the `1.x`). We will discuss the architecture and engineering process of maintaining these components at greater length, leveraging a good deal of the user and developer [documentation](https://jupyterlab-lsp.readthedocs.io/en/latest/?badge=latest).

# Reference-level explanation

> This is the technical portion of the JEP. Explain the design in
> sufficient detail that:
> 
> - Its interaction with other features is clear.
> - It is reasonably clear how the feature would be implemented.
> - Corner cases are dissected by example.
> 
> The section should return to the examples given in the previous section, and explain more fully how the detailed proposal makes those examples work.

The current implementation of the LSP integration is a barely a proof of concept. We belive that a different implementation should be developed to take the more comprehensive use cases and diversity of the Jupyter ecosystem into account; we created detailed proposals for improvement and refactoring of our code as explained later.

## Dealing with Jupyter notebooks complexity

The following features need to be considered in the design:

The interactive, data-driven computing paradigm provides additional convenience features on top of existing languages:
- cell and line magics
- tranclusions: "foregin" code in the document, often implemented as magics which uses a different language or scope than the rest of the document (e.g. `%%html` magic in IPython)
- polyglot notebooks using cell metadata to define language
- the concept of cells, including cell outputs and cell metadata (e.g. enabling LSP extensions to warn users about unused empty cells, out of order execution markers, etc., as briefly discussed in [#467](https://github.com/krassowski/jupyterlab-lsp/issues/467))


## Current implementation

Currently:
- the notebook cells are concatenated into a single temporary ("virtual") document on the frontend, which is then sent to the backend,
   - the navigation between coordinate system is performed by the frontend and is based solely on the total number of lines after concatenation
- as a workaround for some language servers requiring actual presence of the file on the filesystem (against the LSP spec, but common in some less advanced servers), our backend jupyter server extension creates a temporary file on the file system (by default in the `.virtual_documents` directory); this is scheduled for deprecation,
- jupyter server extension serves as:
   - a transparent proxy between LSP language servers and frontend, speaking over websocket connection
   - a manager of language servers, determining whether specific LSP servers are installed and starting their processes
      - JSON files or declarative Python classes registered via entry points are used to define specification of the LSP servers (where to look for an executable of the LSP server, for which languages/kernels given LSP server should be used, what is its display name, etc.)

# Rationale and alternatives

> - Why is this choice the best in the space of possible designs?


> - What other designs have been considered and what is the rationale for not choosing them?

A previous (stale) JEP proposed to integrate LSP and to adopt Monaco editor, which would entail bringing a heavy dependency and large reliance on continious developement of Monaco by Microsoft; it was not clear whether Monaco would allow efficient use in multi-editor notebook setting and the work on the integration stalled a few years ago. Differently to that previous proposal we **do not** propose to adopt any specific implementation, yet we bring a working implementation for CodeMirror editor, which is already in use by two of the official front-ends for Jupyter (Jupyter Notebook and JupyterLab). 


> - What is the impact of not doing this?

The Jupyter originally driving innovation in the field is now in some communities perecieved as a driver behind bad coding practices due to the lack of available toolset in the official frontends. Alternative formats to ipynb were proposed and sometimes the only motivation was a better IDE-features support.

# Prior art

> Discuss prior art, both the good and the bad, in relation to this proposal.
> A few examples of what this can include are:
> 
> - Does this feature exist in other tools or ecosystems, and what experience have their community had?
> - For community proposals: Is this done by some other community and what were their experiences with it?
> - For other teams: What lessons can we learn from what other communities have done here?
> - Papers: Are there any published papers or great posts that discuss this? If you have some relevant papers to refer to, this can serve as a more detailed theoretical background.
> 
> This section is intended to encourage you as an author to think about the lessons from other languages, provide readers of your JEP with a fuller picture.
> If there is no prior art, that is fine - your ideas are interesting to us whether they are brand new or if it is an adaptation from other languages.

Multiple editors already support the Language Server Protocol, whether directly or via extension points, including VSCode, Atom, Brackets (Adobe), Spyder, Visual Studio and many more. The list of clients and their capabilities is described at https://langserver.org/ in the "LSP clients" section and at https://microsoft.github.io/language-server-protocol/implementors/tools/.

Multiple proprietary notebook interfaces attempted integration of language features such as those provided by LSP, including Google Colab, Datalore, Deepnote, and Polynote; due to proprietary implementation details it is not clear how many of the existing solutions employ LSP (or its subset) under the hood.


# Unresolved questions

> - What parts of the design do you expect to resolve through the JEP process before this gets merged?
> - What related issues do you consider out of scope for this JEP that could be addressed in the future independently of the solution that comes out of this JEP?


The current implementation can be improved by:
1. embedding cell identifiers (and possibly metadata) as comments in the virual document at a place corresponding to the start of each cell (in jupytext-compatible way), to enable easier calculation of positions and implementation of refactoring features (e.g. linting with black) that add or remove lines (which is not currently possible),
   - adding metadata might be required to enable polyglot SOS notebooks, see discussion in [#282](https://github.com/krassowski/jupyterlab-lsp/issues/282)
   - one might consider if it is worth to delegate this task to jupytext; this would necessitate moving the notebook concatenation logic to the server extension, with a positive side effect of exposing it for re-use by other clients, but with a potential downsides of the need to frequently transfer the entire notebook (on each debounced keypress) to the server extension (which could be alleviated if implemented via delta/diffs; this adds more logic but given that notebooks is just a JSON it might be feasible to use an existing tool) and with a downside of having the notebook-virtual document position transformation code on both backend and frontend as the frontend part cannot be easily (or at al?) eliminated; as this option looks promising it will be investiagated once current performance shortcomings are resolved.
   - see futher discussion in [#467](https://github.com/krassowski/jupyterlab-lsp/issues/467)
2. formalizing grammar of substituting magics with equivalent or placeholder (which is allows for one-to-one mapping of magics to code that can be understood by standard refactoring tools and back to the magics after the code was transformed by the refactoring tools, for examle moved to another file), see [#347](https://github.com/krassowski/jupyterlab-lsp/issues/347)
3. abstracting the communication layer between client and server so that different mechanisms can be used for such communication, for example:
   - custom, manually managed websocket between by client and jupyter server extension (existing solution),
   - websocket managed reusing the kernel comms (acting as a transparent proxy but reducing the number of dependencies since in the context of Jupter the kernel comms are expected to be present either way), see the propsed implementation in [#278](https://github.com/krassowski/jupyterlab-lsp/pull/278)
   - direct connection to a cloud service providing language intelligence as a service, e.g. [sourcegraph](https://about.sourcegraph.com/).

There are also smaller fires to put out in the current implementation which we believe do not warrant further discussion; however, we want to enumerate those to assure a potentially concerned reader that those topics are being looked at and considered a priority due to the immediate impact on user and/or developer experience:
- reorganizing deeply nested code into shallower structure of multiple packages, one per each feature (with the current state of the repository in half a monorepo, half complex project being an annoyance to maintainers and contributors alike)
- improving performance of completer and overall robustness of the features
- enabling integration with other packages providing completion suggestions
- enabling use of multiple LSP servers for a single server


# Future possibilities

> Think about what the natural extension and evolution of your proposal would
> be and how it would affect the Jupyter community at-large. Try to use this section as a tool to more fully consider all possible
> interactions with the project and language in your proposal.
> Also consider how the this all fits into the roadmap for the project
> and of the relevant sub-team.
> 
> This is also a good place to "dump ideas", if they are out of scope for the
> JEP you are writing but otherwise related.
> 
> If you have tried and cannot think of any future possibilities,
> you may simply state that you cannot think of anything.
> 
> Note that having something written down in the future-possibilities section
> is not a reason to accept the current or a future JEP; such notes should be
> in the section on motivation or rationale in this or subsequent JEPs.
> The section merely provides additional information.

- Amending the kernel messaging protocol to ask only for runtime (e.g. keys in a dictionary, columns in a data frame) and kernel-specific completions (e.g. magics), this is excluding static-analysis based completions, to improve the performance of the completer
- Seeding existing linting tools with plugins to support notebook-specific features (empty cells, out of order execution, largely as envisioned by pioneering work of [JuLynter](https://dew-uff.github.io/julynter/index.html) experiment)
- Encouraging contributions to existing language-servers and offering platform for developement of Jupyter-optimized langauge servers
- Enabling LSP features in markdown cells
- Implementing support for related Language Server Index Format (LSIF), a protocol closely related to LSP and defined on the [specification page](https://microsoft.github.io/language-server-protocol/specifications/lsif/0.5.0/specification/) for even faster IDE features for the retrieval of immutable (or infrequently mutable) information, such as documentation of built-in functions.
