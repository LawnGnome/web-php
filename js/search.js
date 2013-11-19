/**
 * A jQuery plugin to add typeahead search functionality to the navbar search
 * box.  This requires Hogan for templating and typeahead.js for the actual
 * typeahead functionality.
 *
 * @author Adam Harvey <aharvey@php.net>
 */
(function ($) {
    /**
     * A backend, which encapsulates a set of completions, such as a list of
     * functions or classes.
     *
     * @constructor
     * @param {String} label The label to show the user.
     */
    var Backend = function (label) {
        this.label = label;
        this.elements = {};
    };

    /**
     * Adds a description to the given item. If the ID doesn't exist, this
     * method will do nothing, successfully.
     *
     * @param {String} id          The ID to match.
     * @param {String} description The description to add.
     */
    Backend.prototype.addDescription = function (id, description) {
        if (id in this.elements) {
            this.elements[id].description = description;
        }
    };

    /**
     * Adds an item to the backend.
     *
     * @param {String} id     The item ID. It would help if this was unique.
     * @param {String} name   The item name to use as a label.
     * @param {Array}  tokens An array of tokens that should match this item.
     */
    Backend.prototype.addItem = function (id, name, tokens) {
        this.elements[id] = {
            tokens: tokens,
            id: id,
            name: name,
            description: null
        };
    };

    /**
     * Returns the backend contents formatted as an array that typeahead.js can
     * digest as a local data source.
     *
     * @return {Array}
     */
    Backend.prototype.toTypeaheadArray = function () {
        var array = [];

        $.each(this.elements, function (_, element) {
            array.push(element);
        });

        /* This is a rather convoluted sorting function, but the idea is to
         * make the results as useful as possible, since only a few are shown
         * at any one time. In general, we favour shorter names over longer
         * ones, and favour regular functions over methods when sorting
         * functions. Ideally, this would actually sort based on function
         * popularity, but this is a simpler algorithmic approach for now that
         * seems to result in generally useful results. */
        array.sort(function (a, b) {
            var a = a.name;
            var b = b.name;

            var aIsMethod = (a.indexOf("::") != -1);
            var bIsMethod = (b.indexOf("::") != -1);

            // Methods are always after regular functions.
            if (aIsMethod && !bIsMethod) {
                return 1;
            } else if (bIsMethod && !aIsMethod) {
                return -1;
            }

            /* If one function name is the exact prefix of the other, we want
             * to sort the shorter version first (mostly for things like date()
             * versus date_format()). */
            if (a.length > b.length) {
                if (a.indexOf(b) == 0) {
                    return 1;
                }
            } else {
                if (b.indexOf(a) == 0) {
                    return -1;
                }
            }

            // Otherwise, sort normally.
            if (a > b) {
                return 1;
            } else if (a < b) {
                return -1;
            }

            return 0;
        });
        return array;
    };

    /**
     * The actual search plugin. Should be applied to the input that needs
     * typeahead functionality.
     *
     * @param {Object} options The options object. This should include
     *                         "language": the language to try to load,
     *                         "limit": the maximum number of results
     */
    $.fn.search = function (options) {
        var element = this;

        options.language = options.language || "en";
        options.limit = options.limit || 10;

        /**
         * Utility function to check if the user's browser supports local
         * storage and native JSON, in which case we'll use it to cache the
         * search JSON.
         *
         * @return {Boolean}
         */
        var canCache = function () {
            try {
                return ('localStorage' in window && window['localStorage'] !== null && "JSON" in window && window["JSON"] !== null);
            } catch (e) {
                return false;
            }
        };

        /**
         * Given a data structure in the format of our search-description.json
         * files, augments the given backends with descriptions.
         *
         * @param {Object} backends An object or array containing one or more
         *                          Backend objects.
         * @param {Object} desc     A description array, keyed by page ID.
         * @return {Object} The updated backends.
         */
        var processDescription = function (backends, desc) {
            $.each(desc, function (id, description) {
                $.each(backends, function (_, backend) {
                    backend.addDescription(id, description);
                });
            });

            return backends;
        };

        /**
         * Processes a data structure in the format of our search-index.json
         * files and returns an object containing multiple Backend objects.
         *
         * @param {Object} index
         * @return {Object}
         */
        var processIndex = function (index) {
            // The search types we want to support.
            var backends = {
                "function": new Backend("Functions"),
                "class": new Backend("Classes"),
                "general": new Backend("Other Matches")
            };

            $.each(index, function (_, item) {
                /* If the item has a name, then we should figure out what type
                 * of data this is, and hence which backend this should go
                 * into. */
                if (item[0]) {
                    var tokens = [item[0]];
                    var type = null;

                    if (item[1].match(/^function\./)) {
                        type = "function";
                    } else if (item[0].indexOf("::") != -1) {
                        type = "function";

                        /* We'll add tokens to make the autocompletion more
                         * useful: users can search for method names and can
                         * specify that they only want method names by
                         * prefixing their search with ::. */
                        tokens.push(item[0].split("::")[1]);
                        tokens.push("::" + item[0].split("::")[1]);
                    } else if (item[1].match(/^class\./)) {
                        type = "class";
                    } else {
                        /* Most other items don't have headings (which is
                         * probably a bug), but those that do can go into the
                         * other matches category. */
                        type = "general";
                    }

                    if (type) {
                        backends[type].addItem(item[1], item[0], tokens);
                    }
                }
            });

            return backends;
        };

        /**
         * Attempt to asynchronously load the search JSON for a given language.
         *
         * @param {String}   language The language to search for.
         * @param {Function} success  Success handler, which will be given an
         *                            object containing multiple Backend
         *                            objects on success.
         * @param {Function} failure  An optional failure handler.
         */
        var loadLanguage = function (language, success, failure) {
            var key = "search-" + language;

            // Check if the cache has a recent enough search index.
            if (canCache()) {
                var cache = window.localStorage.getItem(key);

                if (cache) {
                    var since = new Date();

                    // Parse the stored JSON.
                    cache = JSON.parse(cache);

                    // We'll use anything that's less than two weeks old.
                    since.setDate(since.getDate() - 14);
                    if (cache.time > since.getTime()) {
                        success($.map(cache.data, function (dataset, name) {
                            // Rehydrate the Backend objects.
                            var backend = new Backend(dataset.label);
                            backend.elements = dataset.elements;

                            return backend;
                        }));
                        return;
                    }
                }
            }

            // OK, nothing cached.
            $.ajax({
                dataType: "json",
                error: failure,
                success: function (data) {
                    // Transform the data into something useful.
                    var backends = processIndex(data);

                    // See if we can augment this with description data.
                    $.ajax({
                        dataType: "json",
                        error: function () {
                            // Return the data without descriptions but don't
                            // cache it.
                            success(backends);
                        },
                        success: function (data) {
                            backends = processDescription(backends, data);

                            // Cache the data if we can.
                            if (canCache()) {
                                window.localStorage.setItem(key, JSON.stringify({
                                    data: backends,
                                    time: new Date().getTime()
                                }));
                            }

                            success(backends);
                        },
                        url: "/manual/" + language + "/search-description.json"
                    });
                },
                url: "/manual/" + language + "/search-index.json"
            });
        };

        /**
         * Actually enables the typeahead on the DOM element.
         *
         * @param {Object} backends An array-like object containing backends.
         */
        var enableSearchTypeahead = function (backends) {
            var template = "<h4>{{ name }}</h4>" +
                           "<span class='description'>{{ description }}</span>";

            // Build the typeahead options array.
            var typeaheadOptions = $.map(backends, function (backend, name) {
                var local = backend instanceof Backend ? backend.toTypeaheadArray() : backend;

                return {
                    name: name,
                    local: backend.toTypeaheadArray(),
                    header: "<h3>" + backend.label + "</h3>",
                    limit: options.limit,
                    valueKey: "name",
                    engine: Hogan,
                    template: template
                };
            });

            /* Construct a global that we can use to track the total number of
             * results from each backend. */
            var results = {};

            // Set up the typeahead and the various listeners we need.
            $(element).typeahead(typeaheadOptions).on("typeahead:selected", function (_, item) {
                /* If the user has selected an autocomplete item and hits
                 * enter, we should take them straight to the page. */
                window.location = "/" + item.id;
            }).on("keyup", (function () {
                /* typeahead.js doesn't give us a reliable event for the
                 * dropdown entries having been updated, so we'll hook into the
                 * input element's keyup instead. The aim here is to put in
                 * fake entries so that the user has a discoverable way to
                 * perform different searches based on what he or she has
                 * entered. */

                // Precompile the templates we need for the fake entries.
                var moreTemplate = Hogan.compile("<a class='more' href='{{ url }}'>&raquo; {{ num }} more result{{ plural }}</a>");
                var searchTemplate = Hogan.compile("<a class='search' href='{{ url }}'>&raquo; Search php.net for {{ pattern }}</a>");

                /* Now we'll return the actual function that should be invoked
                 * when the user has typed something into the search box after
                 * typeahead.js has done its thing. */
                return function () {
                    // Grab what the user entered.
                    var pattern = $(element).val();

                    // Add "n more results" entries to each section.
                    $.each(results, function (name, numResults) {
                        var container = $(".tt-dataset-" + name, $(element).parent());
                        var more = numResults - options.limit;
                        var plural = (more == 1 ? "" : "s");
                        var url = "/search.php?pattern=" + escape(pattern) + "&show=manual";

                        // Class lookups can be done pretty specifically.
                        if (name == "class") {
                            url = "/search.php?pattern=" + escape(pattern + " inurl:class.") + "&show=manual";
                        }

                        $(".more", container).remove();
                        if (pattern.length > 2 && more > 0) {
                            $(container).append(moreTemplate.render({
                                num: more,
                                plural: plural,
                                url: url
                            }));
                        }
                    });

                    /* Add a global search option. Note that, as above, the
                     * link is only displayed if more than 2 characters have
                     * been entered: this is due to our search functionality
                     * requiring at least 3 characters in the pattern. */
                    $(".tt-dropdown-menu .search", $(element).parent()).remove();
                    if (pattern.length > 2) {
                        var dropdown = $(".tt-dropdown-menu", $(element).parent());

                        dropdown.append(searchTemplate.render({
                            pattern: pattern,
                            url: "/search.php?pattern=" + escape(pattern)
                        }));

                        /* If the dropdown is hidden (because there are no
                         * results), show it anyway. */
                        dropdown.show();
                    }
                };
            })());

            /* Override the dataset._getLocalSuggestions() method to grab the
             * number of results each dataset returns when a search occurs. */
            $.each($(element).data().ttView.datasets, function (_, dataset) {
                var originalGetLocal = dataset._getLocalSuggestions;

                dataset._getLocalSuggestions = function () {
                    var suggestions = originalGetLocal.apply(dataset, arguments);

                    results[dataset.name] = suggestions.length;
                    return suggestions;
                };
            });

            /* typeahead.js adds another input element as part of its DOM
             * manipulation, which breaks the auto-submit functionality we
             * previously relied upon for enter keypresses in the input box to
             * work. Adding a hidden submit button re-enables it. */
            $("<input type='submit' style='visibility: hidden; position: fixed' />").insertAfter(element);

            // Fix for a styling issue on the created input element.
            $(".tt-hint", $(element).parent()).addClass("search-query");
        };

        // Look for the user's language, then fall back to English.
        loadLanguage(options.language, enableSearchTypeahead, function () {
            loadLanguage("en", enableSearchTypeahead);
        });

        return this;
    };
})(jQuery);

// vim: set ts=4 sw=4 et:
