$(document).ready(function () {
    var titles = $("*[id] > .title:first-child", $(".page-tools").siblings("*[id]").first());
    
    if (titles.size() > 0) {
        var container = $("<ul class='parent-menu-list'>").prependTo("aside.layout-menu");
        var outer = $("<li><span class='heading'>Contents</span></li>").appendTo(container);
        var toc = $("<ul class='child-menu-list' />").appendTo(outer);

        titles.each(function () {
            var id = $(this).parent().attr("id");
            var title = $(this).contents().filter(function () {
                // Strip out genanchor paragraph marks (but we want everything
                // else, since migration guide titles often include links!).
                return !(this.nodeType == 1 && this.hasAttribute("class") && this.getAttribute("class").indexOf("genanchor") != -1);
            }).text();

            var entry = $("<li />").appendTo(toc);
            var link = $("<a />").attr("href", "#" + id).text(title).appendTo(entry);
        });
    }
});

// vim: set ts=4 sw=4 et:
