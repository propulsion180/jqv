# Changes in library choice

## Change from Ink to Blessed

When I tried to use Ink to create a box with borders (would be used to hold output and input of jq) I found that there is no native way to do so. You can manually draw the box using ascii or use a plugin (that I could not install for some reason) but if you just put text input into a box object it acted more like a div in html.

That is why I swapped over to Blessed. In blessed the Box object has borders without manually drawing it with ascii or using a plugin. This greatly simplified the UI.
