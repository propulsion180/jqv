# jqv

### What is jqv

jqv stands for jq visualised.

It is meant to be a drop in replacement for jq where the user can visualise what data is being filtered out and modified by each part of the jq filter.

An example showing the expected functionality can be found at this [website](https://homepages.ecs.vuw.ac.nz/~mwh/demos/paint2023/)

### How to install it

#### Depedencies

- pnpm
- bash

#### Steps

- Clone the repository
- Run the install script
- Add `.~/.local/bin` to your systems's PATH

#### Navigating the application while running.

At startup you will be focused on the filter input.

To go to the JSON input or the output area press the escape key and then use numbers 1 - 3 to focus to any of the three panes. The number you need to hit is in the label.

When the outputBox is focused use the arrow keys to move the content.
