# cyclone-sim
A fork of [Monsoonjr99](https://monsoonjr99.github.io)'s [cyclone-sim](https://moonsoonjr99.github.io/cyclone-sim/), a p5.js tropical cyclone simulation game, intended to be more efficient in terms of code and performance. Formerly known as Mona Spoon's Gerrymandered World. This is a work in progress, and is not yet finished. If you want to contribute, see the [contributing](#can-i-contribute) section.

## How can I play this?
You can play the game [here](https://strawberrymaster.github.io/cyclone-sim/). Alternatively, download the files, extract them to a folder and open index.html in your browser.
## You said this is more efficient. How so?
I have made a few changes to the code to make it more efficient, or at least easier to update. Among these changes are:
- Updating the [p5.js](https://p5js.org) library to the latest version - old one was from 2019!
- Replacing [moment.js](https://momentjs.com/) with [luxon.js](https://moment.github.io/luxon/), which is a smaller library that does the same thing.
- Cacheing the results of some functions, so that they don't have to be recalculated every frame.
- Replacing constants with enums, for simplicity.
- Lots of other small changes.
## Can I contribute?
Sure! You can fork this repository, make your changes, and then create a pull request. Make sure to test your changes before creating a pull request. I will review your changes and merge them if they seem good. If you are not sure what to work on, you can look at the issues tab, which contains a list of issues that need to be fixed.
## How can I report a bug?
You can create an issue on the issues tab. Make sure to include a description of the bug, and how to reproduce it. If you can, include a screenshot of the bug, and check to see if the bug can be reproduced in the original Cyclone Simulator. If you are not sure how to create an issue, you can look at the [GitHub documentation](https://docs.github.com/en/github/managing-your-work-on-github/creating-an-issue).