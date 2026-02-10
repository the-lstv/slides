<img src="assets/icon.svg" alt="Slides Logo">

# slides

Simple presentation framework I made for my school presentations. Note that this is a personal project that I am just leaving open to anyone who likes it; it is not a released product.

It allows you to make presentations with code easily and publish them instantly. It's very lightweight, yet very flexible.

It is built on my backend framework [Akeno](https://github.com/the-lstv/akeno) and frontend framework [LS](https://github.com/the-lstv/ls), which keep it extremely simple and minimal.
Animations are done with WAAPI.

[Check out the default presentation.](https://slides.lstv.space)

## File Structure
- `/assets`
    - `presentation.html` The base used by all presentations, contains the global presentation logic.
- `/presentations`
    - `<presentation_name>` Each presentation has its folder.
        - `index.html` Extends the base (thanks to Akeno's #template) and contains slide content & specific logic. It's as simple as that; zero boilerplate. Supports markdown too.
- `app.conf` Configuration file for the server.

## Hosting it yourself
If you want to use this yourself, it's simple: get [Akeno](https://github.com/the-lstv/akeno), clone this repository and point Akeno at it as one of the website locations, and done!
You should then be able to visit [this in your browser](http://slides.localhost) with your local copy. Then you can create your own presentations by creating a new folder in `/presentations` and following the format.

## Some simple presentations I made
- [Programming languages](https://slides.lstv.space/programming-languages) (2026)
- [System security](https://slides.lstv.space/system-security) (2025)
- Computer hardware (2024) (lost)
- Motherboards (2023) (lost)

*Note that these are middle-school level presentations made for people that don't understand computers. I apologize for inaccuracies or bias : ) - use only as a technical demo*

## Importing slides from Figma
Origin story that you don't care about; I made this originally a few years ago out of hate for PowerPoint. Then I abandoned it (forced to use PowerPoint >:(), and later I found Figma slides. Figma slides seemed like the perfect thing; I already used Figma, and using it for presentations just made sense. But it was a disappointment; attrocious animation system, complete lack of features, and too slow for our 10 year old school computers.

So I just revived this project again.

SVG is supported (as is any HTML element), so adding something from Figma is as easy as exporting it into SVG (if you want custom text, make sure to export without the "Outline Text" option, and don't forget to include fonts you use with `@use(google-fonts[...names])` (or a custom source)).

To make it easier, there is a converter to when you are exporting many slides at once - run `node ./misc/figma-converter.js <zip export file> <output folder>`. This will append SVG files from the zip file at the end of your index.html file in whatever folder you specify, and keep track of the file name, meaning that if you apply the same twice, it will patch the old ones. Warning; this will overwrite whatever changes you made to that slide before.

## Contributing
Yeah you are welcome to do that if you want.

## License
/assets is licensed under GPLv3. You are free to do things with it.

The /presentations found here are personal; they may include copyrighted stuff for what I know. But the things I authored in there are licensed under the MIT license.