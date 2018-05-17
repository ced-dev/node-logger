/* global __dirname */
const g = global;

module.exports = class Logger {
    constructor(options) {
        let s = this;
        s.tag = "[" + s.constructor.name + "] ";
        s.options = Object.assign({
            appenders: {
                console: {
                    enabled: true,
                    pattern: "[%date%] [%level%] %message%",
                    dateformat: "yyyy-mm-dd HH:MM:ss.l",
                    tags: [
                        {search: "<b>*</b>", replace: "\x1b[1m*\x1b[0m"},
                        {search: "<u>*</u>", replace: "\x1b[4m*\x1b[0m"}
                    ],
                    levels: {
                        info: {enabled: true, text: "\x1b[32mINFO-\x1b[0m"},
                        debug: {enabled: true, text: "\x1b[36mDEBUG\x1b[0m"},
                        warn: {enabled: true, text: "\x1b[33mWARN-\x1b[0m"},
                        error: {enabled: true, text: "\x1b[31mERROR\x1b[0m", stack: true}
                    },
                    call: function (msg) {
                        console.log(msg);
                    }
                },
                file: {
                    enabled: true,
                    pattern: "[%date%] [%level%] %message%",
                    dateformat: "yyyy-mm-dd HH:MM:ss.l",
                    tags: [
                        {search: "<b>*</b>", replace: "*"},
                        {search: "<b>*</b>", replace: "*"}
                    ],
                    levels: {
                        info: {enabled: true, text: "INFO-"},
                        debug: {enabled: true, text: "DEBUG"},
                        warn: {enabled: true, text: "WARN-"},
                        error: {enabled: true, text: "ERROR", stack: true}
                    },
                    name: null,
                    stream: null,
                    call: function (msg) {
                        this.stream.write(msg + "\n");
                    }
                }
            },
            stacktrace_verbose: true,
            stacktrace_limit: 50
        }, g.config.logger, options);

        if (!s.options.appenders.file.name) {
            s.options.appenders.file.name = ((g.config && g.config.logfile) ? g.config.logfile : "./" + (g.package && g.package.name ? g.package.name : "temp") + ".log").replace(/\W\.+/g, "");
        }

        if (s.options.appenders.file.enabled) {
            s.options.appenders.file.stream = g.fs.createWriteStream(s.options.appenders.file.name, {flags: "a", encoding: "utf8"});
        }

        for (var app in s.options.appenders) {
            var appender = s.options.appenders[app];
            appender.tags_cache = [];
            for (var i = 0; i < appender.tags.length; i++) {
                let tag = appender.tags[i];//.replace(/\<stop\>/g, s.options.colorstop);
                let source = tag.search.split("*");
                let target = tag.replace.split("*");
                source[0] = source[0].replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
                source[1] = source[1].replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
                target[0] = target[0] || "";
                target[1] = target[1] || "";
                let regex = new RegExp(source[0] + "(.*)" + source[1], "g");
                let result = target[0] + "$1" + target[1];
                appender.tags_cache.push({regex: regex, result: result});
            }
        }

        Error.stackTraceLimit = s.options.stacktrace_limit;
        
        g.events.EventEmitter.call(this);
        Logger.prototype.__proto__ = g.events.EventEmitter.prototype;
    }

    add(level, ...args)
    {
        let s = this;
        try {
            let text = "";

            for (var i = 0; i < args.length; i++) {
                if (!args[i])
                    continue;
                if (i > 0)
                    text += "\n\t";
                if (args[i] instanceof Error) {
                    if (args[i].message)
                        text += "<u>Message:</u> " + args[i].message.trim().replace(/\n/g, "\n\t") + "\n\t";
                    if (!args[i].stack)
                        args[i].stack = new Error().stack;
                    let spl = args[i].stack.split("\n");
                    let result = [];
                    for (var y = 0; y < spl.length; y++) {
                        if (spl[y].length < 1)
                            continue;
                        result.push(spl[y]);
                        if (y > 0 && !s.options.stacktrace_verbose && spl[y].startsWith("    at ") && spl[y].indexOf(__dirname) < 0)
                            break;
                    }
                    text += "<u>StackTrace:</u> " + result.join("\n\t") + "";
                } else {
                    var argstr = args[i].toString().trim();
                    switch (typeof args[i]) {

                        case "string":
                        case "number":
                        case "boolean":
                            text += argstr.replace(/\n/g, "\n\t");
                            break;
                        default:
                            text += ((typeof args[i] === "object" && Object.keys(args[i]).length > 0) ? JSON.stringify(args[i]) : argstr);
                            break;
                    }
                }
            }

            for (var app in s.options.appenders) {
                var appender = s.options.appenders[app];
                if (appender.enabled && appender.levels[level].enabled) {

                    var message = text;
                    for (var r = 0; r < appender.tags_cache.length; r++) {
                        if (appender.tags_cache[r].regex.test(message)) {
                            message = message.replace(appender.tags_cache[r].regex, appender.tags_cache[r].result);
                        }
                    }

                    var result = appender.pattern
                            .replace("%date%", g.dateformat(new Date(), appender.dateformat))
                            .replace("%level%", appender.levels[level].text)
                            .replace("%message%", message);

                    try {
                        appender.call(result);
                    } catch (e) {
                        console.log(e);
                    }
                }
            }
            
            s.emit("add", level, ...args);

        } catch (e) {
            console.log(e);
        }
    }

    info(...args) {
        return this.add("info", ...args);
    }
    debug(...args) {
        return this.add("debug", ...args);
    }
    warn(...args) {
        return this.add("warn", ...args);
    }
    error(...args) {
        return this.add("error", ...args);
    }
};