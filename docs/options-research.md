# Language and library options

### TUI Library options

 - GO
  - BubbleTea
    - Very good looking. But more complicated than the alternative
    - May take longer to create a end product
  - Tui-go
    - predecessor to tview
    - simple
    - still in experimental phase
  - Tview
   - end results have similar design to tui-go, more simple than bubbletea
   - can handle more complex layouts
   - more widget options
 - Rust
  - Ratatui
    - Lots of options like bubbletea for go
    - More complicated to write than go. also less experience
 - Javascript
  - Blessed
   - Can create all kinds of tuis. Tabbed, floating windows and etc.
  - Ink 
   - Written using react components 
   - Easy to make dynamic changes depending on a variable

### Jq Library options

- [Michael Homer's jqjs](https://github.com/mwh/jqjs) 
    - pros
     - has all the functionality needed since it is what is running in the demo website
    - cons
     - in javascript so TUI libraries are limited.

- Rewriting jq.js in another language
 - Pros 
  - can use a language that has more tui library choices than JS.
 - Cons
  - Will take longer, so might not be able to get all the functionality working by the end.

- Could not find another existing jq library with a built in trace function.

- Modify an existing library like gojq (jq in golang).
 - Pros
  - More flexibility in TUI Libraries
 - Cons
  - Depending on the complexity of the library it may take a long time.

- Use jqjs in a language other than JavaScript
 - To use jqjs in golang you can use the v8go library to run JavaScript. 
 - js-sandbox can be used to run Javascript in Rust
- These methods are very sketchy solutions and should be used as a last resort.
