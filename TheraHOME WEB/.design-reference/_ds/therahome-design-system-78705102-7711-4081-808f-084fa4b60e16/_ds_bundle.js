/* @ds-bundle: {"format":4,"namespace":"TheraHOMEDesignSystem_787051","components":[{"name":"Button","sourcePath":"components/buttons/Button.jsx"},{"name":"FAB","sourcePath":"components/buttons/FAB.jsx"},{"name":"Calendar","sourcePath":"components/calendar/Calendar.jsx"},{"name":"DoseCard","sourcePath":"components/cards/DoseCard.jsx"},{"name":"ProgramCard","sourcePath":"components/cards/ProgramCard.jsx"},{"name":"SuccessCard","sourcePath":"components/cards/SuccessCard.jsx"},{"name":"LabelChip","sourcePath":"components/chips/LabelChip.jsx"},{"name":"SegmentedControl","sourcePath":"components/chips/SegmentedControl.jsx"},{"name":"Avatar","sourcePath":"components/forms/Avatar.jsx"},{"name":"FormField","sourcePath":"components/forms/FormField.jsx"},{"name":"Icon","sourcePath":"components/icons/Icon.jsx"},{"name":"ListItem","sourcePath":"components/lists/ListItem.jsx"},{"name":"Drawer","sourcePath":"components/navigation/Drawer.jsx"},{"name":"TabBar","sourcePath":"components/navigation/TabBar.jsx"},{"name":"ScanFrame","sourcePath":"components/scan/ScanFrame.jsx"}],"sourceHashes":{"components/buttons/Button.jsx":"f2d3c2f1167d","components/buttons/FAB.jsx":"64113818944b","components/calendar/Calendar.jsx":"311a7429a169","components/cards/DoseCard.jsx":"6b26b58e7c31","components/cards/ProgramCard.jsx":"6e95f41f92f9","components/cards/SuccessCard.jsx":"f955a19ddd78","components/chips/LabelChip.jsx":"df2441a27fc9","components/chips/SegmentedControl.jsx":"d66fb38be2e7","components/forms/Avatar.jsx":"b85e4f52e3f9","components/forms/FormField.jsx":"3e49b27d0c4e","components/icons/Icon.jsx":"9004bdc4315e","components/lists/ListItem.jsx":"4b74b04606f6","components/navigation/Drawer.jsx":"c35a41a99c10","components/navigation/TabBar.jsx":"84d98a06404a","components/scan/ScanFrame.jsx":"daf286bd984b","ui_kits/medication-app/Screens.jsx":"0fb6b47e8240","ui_kits/medication-app/Shell.jsx":"12e86c714f0a"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.TheraHOMEDesignSystem_787051 = window.TheraHOMEDesignSystem_787051 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/buttons/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Button({
  variant = "primary",
  children,
  disabled,
  style,
  ...props
}) {
  const base = {
    height: 52,
    borderRadius: "var(--radius-md)",
    fontFamily: "var(--font-family)",
    fontSize: "var(--text-button-size)",
    lineHeight: "var(--text-button-lh)",
    fontWeight: "var(--text-button-weight)",
    border: "none",
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.4 : 1,
    padding: "0 24px",
    transition: "background 150ms ease-out, transform 150ms ease-out"
  };
  const variants = {
    primary: {
      background: "var(--color-primary)",
      color: "var(--text-on-primary)"
    },
    secondary: {
      background: "var(--bg-card)",
      color: "var(--color-primary)",
      border: "1px solid var(--border-input)"
    }
  };
  return /*#__PURE__*/React.createElement("button", _extends({
    disabled: disabled,
    style: {
      ...base,
      ...variants[variant],
      ...style
    },
    onMouseDown: e => {
      if (!disabled) e.currentTarget.style.transform = "scale(0.97)";
    },
    onMouseUp: e => {
      e.currentTarget.style.transform = "scale(1)";
    },
    onMouseLeave: e => {
      e.currentTarget.style.transform = "scale(1)";
    }
  }, props), children);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/buttons/Button.jsx", error: String((e && e.message) || e) }); }

// components/calendar/Calendar.jsx
try { (() => {
const DAYS = ["S", "M", "T", "W", "T", "F", "S"];
function Calendar({
  monthLabel,
  today,
  doseDays = [],
  onSelectDay,
  style
}) {
  const cells = Array.from({
    length: 35
  }, (_, i) => i - 3);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--bg-card)",
      borderRadius: "var(--radius-lg)",
      padding: "var(--space-4)",
      boxShadow: "var(--shadow-card)",
      fontFamily: "var(--font-family)",
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: "var(--space-4)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 18,
      color: "var(--text-secondary)",
      cursor: "pointer"
    }
  }, "‹"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "var(--text-h1-size)",
      fontWeight: "var(--text-h1-weight)",
      color: "var(--text-primary)"
    }
  }, monthLabel), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 18,
      color: "var(--text-secondary)",
      cursor: "pointer"
    }
  }, "›")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(7,1fr)",
      gap: 4,
      marginBottom: 8
    }
  }, DAYS.map((d, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      textAlign: "center",
      fontSize: "var(--text-caption-sm-size)",
      fontWeight: 500,
      color: "var(--text-muted)"
    }
  }, d))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(7,1fr)",
      gap: 4
    }
  }, cells.map((n, i) => {
    if (n < 1 || n > 30) return /*#__PURE__*/React.createElement("div", {
      key: i
    });
    const isToday = n === today;
    const hasDose = doseDays.includes(n);
    return /*#__PURE__*/React.createElement("div", {
      key: i,
      onClick: () => onSelectDay && onSelectDay(n),
      style: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2,
        cursor: "pointer"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: 32,
        height: 32,
        borderRadius: "var(--radius-full)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: isToday ? "var(--color-primary)" : "transparent",
        color: isToday ? "#fff" : "var(--text-primary)",
        fontSize: 13
      }
    }, n), /*#__PURE__*/React.createElement("div", {
      style: {
        width: 4,
        height: 4,
        borderRadius: "var(--radius-full)",
        background: hasDose ? "var(--accent-orange)" : "transparent"
      }
    }));
  })));
}
Object.assign(__ds_scope, { Calendar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/calendar/Calendar.jsx", error: String((e && e.message) || e) }); }

// components/chips/LabelChip.jsx
try { (() => {
function LabelChip({
  children,
  style
}) {
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-block",
      background: "var(--text-primary)",
      color: "#fff",
      borderRadius: "var(--radius-full)",
      padding: "6px 14px",
      fontFamily: "var(--font-family)",
      fontSize: "var(--text-caption-size)",
      fontWeight: 500,
      ...style
    }
  }, children);
}
Object.assign(__ds_scope, { LabelChip });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/chips/LabelChip.jsx", error: String((e && e.message) || e) }); }

// components/chips/SegmentedControl.jsx
try { (() => {
const {
  useState
} = React;
function SegmentedControl({
  options,
  value,
  onChange,
  style
}) {
  const [internal, setInternal] = useState(value ?? options[0]);
  const active = value ?? internal;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "inline-flex",
      background: "var(--bg-card-alt)",
      borderRadius: "var(--radius-full)",
      padding: 4,
      fontFamily: "var(--font-family)",
      ...style
    }
  }, options.map(opt => {
    const isActive = opt === active;
    return /*#__PURE__*/React.createElement("button", {
      key: opt,
      onClick: () => {
        setInternal(opt);
        onChange && onChange(opt);
      },
      style: {
        height: 36,
        padding: "0 18px",
        borderRadius: "var(--radius-full)",
        border: "none",
        cursor: "pointer",
        background: isActive ? "var(--color-primary)" : "transparent",
        color: isActive ? "var(--text-on-primary)" : "var(--text-secondary)",
        fontSize: "var(--text-body-size)",
        fontWeight: 600,
        transition: "background 200ms ease-out"
      }
    }, opt);
  }));
}
Object.assign(__ds_scope, { SegmentedControl });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/chips/SegmentedControl.jsx", error: String((e && e.message) || e) }); }

// components/forms/FormField.jsx
try { (() => {
function FormField({
  label,
  value,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "var(--space-3) 0",
      borderBottom: "1px solid var(--divider)",
      fontFamily: "var(--font-family)",
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "var(--text-caption-size)",
      color: "var(--text-secondary)",
      marginBottom: 4
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "var(--text-body-strong-size)",
      fontWeight: "var(--text-body-strong-weight)",
      color: "var(--text-primary)"
    }
  }, value));
}
Object.assign(__ds_scope, { FormField });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/FormField.jsx", error: String((e && e.message) || e) }); }

// components/icons/Icon.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const PATHS = {
  home: /*#__PURE__*/React.createElement("path", {
    d: "M4 11.5 12 4l8 7.5V20a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"
  }),
  calendar: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("rect", {
    x: "4",
    y: "5",
    width: "16",
    height: "16",
    rx: "2"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M4 10h16M8 3v4M16 3v4"
  })),
  "link-2": /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("circle", {
    cx: "8",
    cy: "12",
    r: "3.5"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "16",
    cy: "12",
    r: "3.5"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M11 12h2"
  })),
  settings: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "3"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M12 3v2M12 19v2M4.2 6.2l1.4 1.4M18.4 16.4l1.4 1.4M3 12h2M19 12h2M4.2 17.8l1.4-1.4M18.4 7.6l1.4-1.4"
  })),
  plus: /*#__PURE__*/React.createElement("path", {
    d: "M12 4v16M4 12h16"
  }),
  bell: /*#__PURE__*/React.createElement("path", {
    d: "M6 10a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6ZM10 20a2 2 0 0 0 4 0"
  }),
  check: /*#__PURE__*/React.createElement("path", {
    d: "M4 12.5 9.5 18 20 6"
  }),
  "triangle-alert": /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
    d: "M12 4 2 20h20L12 4Z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M12 11v3.5M12 17.5h.01"
  })),
  circle: /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "7"
  }),
  x: /*#__PURE__*/React.createElement("path", {
    d: "M6 6l12 12M18 6 6 18"
  }),
  pencil: /*#__PURE__*/React.createElement("path", {
    d: "M4 20l1-4L16 5l3 3L8 19l-4 1ZM14 6l3 3"
  }),
  camera: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("rect", {
    x: "3",
    y: "7",
    width: "18",
    height: "13",
    rx: "2"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "13.5",
    r: "3.5"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M9 7l1.5-2h3L15 7"
  })),
  user: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "8.5",
    r: "3.5"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M5 20c1-4 4-6 7-6s6 2 7 6"
  })),
  "log-out": /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
    d: "M9 4H6a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h3"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M14 8l4 4-4 4M18 12H9"
  })),
  menu: /*#__PURE__*/React.createElement("path", {
    d: "M4 7h16M4 12h16M4 17h16"
  }),
  pill: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("rect", {
    x: "4",
    y: "9.5",
    width: "16",
    height: "5",
    rx: "2.5"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M12 9.5v5"
  }))
};
function Icon({
  name,
  size = 24,
  color = "currentColor",
  style,
  ...props
}) {
  return /*#__PURE__*/React.createElement("svg", _extends({
    viewBox: "0 0 24 24",
    width: size,
    height: size,
    fill: "none",
    stroke: color,
    strokeWidth: "1.8",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    style: {
      flex: "0 0 auto",
      ...style
    }
  }, props), PATHS[name] || /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "8"
  }));
}
Object.assign(__ds_scope, { Icon });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/icons/Icon.jsx", error: String((e && e.message) || e) }); }

// components/buttons/FAB.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function FAB({
  icon = "plus",
  size = 56,
  style,
  ...props
}) {
  return /*#__PURE__*/React.createElement("button", _extends({
    style: {
      width: size,
      height: size,
      borderRadius: "var(--radius-full)",
      border: "none",
      background: "var(--color-primary)",
      boxShadow: "var(--shadow-fab)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "pointer",
      transition: "transform 150ms ease-out",
      ...style
    },
    onMouseDown: e => e.currentTarget.style.transform = "scale(0.92)",
    onMouseUp: e => e.currentTarget.style.transform = "scale(1)",
    onMouseLeave: e => e.currentTarget.style.transform = "scale(1)"
  }, props), /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: size * 0.43,
    color: "var(--text-on-primary)"
  }));
}
Object.assign(__ds_scope, { FAB });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/buttons/FAB.jsx", error: String((e && e.message) || e) }); }

// components/cards/DoseCard.jsx
try { (() => {
const STATUS = {
  pending: {
    badgeBg: "var(--accent-orange-tint)",
    iconColor: "var(--accent-orange)",
    dot: "var(--accent-orange)"
  },
  taken: {
    badgeBg: "var(--success-tint)",
    iconColor: "var(--success)",
    dot: "var(--success)"
  },
  missed: {
    badgeBg: "var(--error-tint)",
    iconColor: "var(--error)",
    dot: "var(--error)"
  }
};
function DoseCard({
  name,
  dosage,
  time,
  status = "pending",
  icon = "pill",
  style
}) {
  const s = STATUS[status] || STATUS.pending;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 12,
      background: "var(--bg-card)",
      borderRadius: "var(--radius-lg)",
      padding: "var(--space-4)",
      boxShadow: "var(--shadow-card)",
      fontFamily: "var(--font-family)",
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 40,
      height: 40,
      borderRadius: "var(--radius-full)",
      background: s.badgeBg,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flex: "0 0 auto"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 20,
    color: s.iconColor
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "var(--text-body-strong-size)",
      fontWeight: "var(--text-body-strong-weight)",
      color: "var(--text-primary)"
    }
  }, name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "var(--text-caption-size)",
      color: "var(--text-secondary)"
    }
  }, dosage)), status === "pending" ? /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "var(--text-caption-size)",
      color: "var(--color-primary)",
      fontWeight: 600
    }
  }, time) : /*#__PURE__*/React.createElement("div", {
    style: {
      width: 10,
      height: 10,
      borderRadius: "var(--radius-full)",
      background: s.dot
    }
  }));
}
Object.assign(__ds_scope, { DoseCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/cards/DoseCard.jsx", error: String((e && e.message) || e) }); }

// components/cards/ProgramCard.jsx
try { (() => {
const STATUS_ICON = {
  taken: {
    name: "check",
    color: "var(--success)"
  },
  due: {
    name: "triangle-alert",
    color: "var(--warning)"
  },
  upcoming: {
    name: "circle",
    color: "var(--text-muted)"
  }
};
function ProgramCard({
  memberName,
  relation,
  status = "upcoming",
  style
}) {
  const s = STATUS_ICON[status] || STATUS_ICON.upcoming;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 12,
      background: "var(--bg-card)",
      borderRadius: "var(--radius-lg)",
      padding: "var(--space-4)",
      boxShadow: "var(--shadow-card)",
      fontFamily: "var(--font-family)",
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 40,
      height: 40,
      borderRadius: "var(--radius-full)",
      background: "var(--bg-card-alt)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flex: "0 0 auto"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "user",
    size: 20,
    color: "var(--text-secondary)"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "var(--text-body-strong-size)",
      fontWeight: "var(--text-body-strong-weight)",
      color: "var(--text-primary)"
    }
  }, memberName), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "var(--text-caption-size)",
      color: "var(--text-secondary)"
    }
  }, relation)), /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: s.name,
    size: 20,
    color: s.color
  }));
}
Object.assign(__ds_scope, { ProgramCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/cards/ProgramCard.jsx", error: String((e && e.message) || e) }); }

// components/cards/SuccessCard.jsx
try { (() => {
function SuccessCard({
  title = "Success!",
  description,
  buttonLabel = "Done",
  onAction,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width: 320,
      background: "var(--bg-card)",
      borderRadius: "var(--radius-xl)",
      padding: "var(--space-8) var(--space-6) var(--space-6)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      textAlign: "center",
      gap: "var(--space-3)",
      fontFamily: "var(--font-family)",
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 72,
      height: 72,
      borderRadius: "var(--radius-full)",
      background: "var(--success-tint)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "check",
    size: 36,
    color: "var(--success)"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "var(--text-h2-size)",
      fontWeight: "var(--text-h2-weight)",
      color: "var(--text-primary)"
    }
  }, title), description && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "var(--text-body-size)",
      color: "var(--text-secondary)"
    }
  }, description), /*#__PURE__*/React.createElement(__ds_scope.Button, {
    variant: "primary",
    style: {
      width: "100%",
      marginTop: "var(--space-2)"
    },
    onClick: onAction
  }, buttonLabel));
}
Object.assign(__ds_scope, { SuccessCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/cards/SuccessCard.jsx", error: String((e && e.message) || e) }); }

// components/forms/Avatar.jsx
try { (() => {
function Avatar({
  size = 88,
  editable = false,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      width: size,
      height: size,
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: size,
      height: size,
      borderRadius: "var(--radius-full)",
      background: "var(--bg-card-alt)"
    }
  }), editable && /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      bottom: 0,
      right: 0,
      width: size * 0.32,
      height: size * 0.32,
      borderRadius: "var(--radius-full)",
      background: "var(--color-primary)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      border: "2px solid var(--bg-card)"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "pencil",
    size: size * 0.15,
    color: "#fff"
  })));
}
Object.assign(__ds_scope, { Avatar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Avatar.jsx", error: String((e && e.message) || e) }); }

// components/lists/ListItem.jsx
try { (() => {
const TYPE_COLOR = {
  reminder: "var(--color-primary-tint-10)",
  success: "var(--success-tint)",
  warning: "var(--warning-tint)"
};
const TYPE_ICON = {
  reminder: {
    name: "bell",
    color: "var(--color-primary)"
  },
  success: {
    name: "check",
    color: "var(--success)"
  },
  warning: {
    name: "triangle-alert",
    color: "var(--warning)"
  }
};
function ListItem({
  title,
  timestamp,
  type = "reminder",
  divider = true,
  style
}) {
  const icon = TYPE_ICON[type] || TYPE_ICON.reminder;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 12,
      padding: "var(--space-3) var(--space-4)",
      borderBottom: divider ? "1px solid var(--divider)" : "none",
      fontFamily: "var(--font-family)",
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 36,
      height: 36,
      borderRadius: "var(--radius-full)",
      background: TYPE_COLOR[type] || TYPE_COLOR.reminder,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flex: "0 0 auto"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon.name,
    size: 18,
    color: icon.color
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "var(--text-body-size)",
      color: "var(--text-primary)"
    }
  }, title), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "var(--text-caption-size)",
      color: "var(--text-muted)"
    }
  }, timestamp)));
}
Object.assign(__ds_scope, { ListItem });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/lists/ListItem.jsx", error: String((e && e.message) || e) }); }

// components/navigation/Drawer.jsx
try { (() => {
function Drawer({
  userName,
  items,
  activeIndex = 0,
  onSelect,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width: 280,
      height: "100%",
      background: "var(--bg-app)",
      padding: "var(--space-6) var(--space-4)",
      display: "flex",
      flexDirection: "column",
      fontFamily: "var(--font-family)",
      boxSizing: "border-box",
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 12,
      marginBottom: "var(--space-6)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 48,
      height: 48,
      borderRadius: "var(--radius-full)",
      background: "var(--bg-card-alt)"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "var(--text-h2-size)",
      fontWeight: "var(--text-h2-weight)",
      color: "var(--text-primary)"
    }
  }, "Hi, ", userName, "!")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 4,
      flex: 1
    }
  }, items.map((item, i) => {
    const active = i === activeIndex;
    return /*#__PURE__*/React.createElement("button", {
      key: item.label,
      onClick: () => onSelect && onSelect(i),
      style: {
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px var(--space-3)",
        borderRadius: "var(--radius-md)",
        border: "none",
        cursor: "pointer",
        textAlign: "left",
        background: active ? "var(--color-primary-tint-10)" : "transparent"
      }
    }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
      name: item.icon,
      size: 20,
      color: active ? "var(--color-primary)" : "var(--text-primary)"
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: "var(--text-body-size)",
        color: active ? "var(--color-primary)" : "var(--text-primary)",
        fontWeight: active ? 600 : 400
      }
    }, item.label));
  })), /*#__PURE__*/React.createElement("button", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 12,
      padding: "12px var(--space-3)",
      background: "none",
      border: "none",
      cursor: "pointer",
      textAlign: "left"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "log-out",
    size: 20,
    color: "var(--error)"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "var(--text-body-size)",
      color: "var(--error)"
    }
  }, "Log Out")));
}
Object.assign(__ds_scope, { Drawer });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/Drawer.jsx", error: String((e && e.message) || e) }); }

// components/navigation/TabBar.jsx
try { (() => {
function TabBar({
  tabs,
  activeIndex = 0,
  onChange,
  style
}) {
  const mid = Math.floor(tabs.length / 2);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-around",
      height: 64,
      background: "var(--bg-card)",
      borderRadius: "var(--radius-full)",
      boxShadow: "var(--shadow-nav)",
      padding: "0 12px",
      fontFamily: "var(--font-family)",
      ...style
    }
  }, tabs.map((tab, i) => i === mid ? /*#__PURE__*/React.createElement("div", {
    key: "fab",
    style: {
      display: "flex",
      flex: "0 0 auto"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.FAB, {
    icon: tab.icon,
    size: 56,
    style: {
      position: "relative",
      top: -18
    },
    onClick: () => onChange && onChange(i)
  })) : /*#__PURE__*/React.createElement("button", {
    key: tab.icon,
    onClick: () => onChange && onChange(i),
    style: {
      background: "none",
      border: "none",
      cursor: "pointer",
      padding: 8
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: tab.icon,
    size: 24,
    color: i === activeIndex ? "var(--color-primary)" : "var(--text-muted)"
  }))));
}
Object.assign(__ds_scope, { TabBar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/TabBar.jsx", error: String((e && e.message) || e) }); }

// components/scan/ScanFrame.jsx
try { (() => {
function ScanFrame({
  resultName,
  resultDetail,
  style
}) {
  const corner = {
    position: "absolute",
    width: 28,
    height: 28,
    border: "3px solid #fff"
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      width: 320,
      height: 400,
      background: "#16213A",
      borderRadius: "var(--radius-lg)",
      overflow: "hidden",
      fontFamily: "var(--font-family)",
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      ...corner,
      top: 24,
      left: 24,
      borderRight: "none",
      borderBottom: "none",
      borderRadius: "6px 0 0 0"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      ...corner,
      top: 24,
      right: 24,
      borderLeft: "none",
      borderBottom: "none",
      borderRadius: "0 6px 0 0"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      ...corner,
      bottom: 100,
      left: 24,
      borderRight: "none",
      borderTop: "none",
      borderRadius: "0 0 0 6px"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      ...corner,
      bottom: 100,
      right: 24,
      borderLeft: "none",
      borderTop: "none",
      borderRadius: "0 0 6px 0"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      top: 16,
      left: 16,
      width: 32,
      height: 32,
      borderRadius: "var(--radius-full)",
      background: "rgba(255,255,255,0.25)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "#fff"
    }
  }, "\xD7"), resultName && /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      background: "var(--bg-card)",
      borderRadius: "var(--radius-lg) var(--radius-lg) 0 0",
      padding: "var(--space-4)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "var(--text-body-strong-size)",
      fontWeight: 600,
      color: "var(--text-primary)"
    }
  }, resultName), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "var(--text-caption-size)",
      color: "var(--text-secondary)"
    }
  }, resultDetail)));
}
Object.assign(__ds_scope, { ScanFrame });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/scan/ScanFrame.jsx", error: String((e && e.message) || e) }); }

// ui_kits/medication-app/Screens.jsx
try { (() => {
const {
  Icon,
  Button,
  FAB,
  TabBar,
  DoseCard,
  ProgramCard,
  SuccessCard,
  SegmentedControl,
  ListItem,
  Calendar,
  FormField,
  Avatar,
  ScanFrame,
  Drawer
} = window.TheraHOMEDesignSystem_787051;
const {
  TopBar
} = window;
function HomeScreen({
  onOpenSuccess
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "0 20px 100px",
      overflowY: "auto",
      height: "100%",
      boxSizing: "border-box"
    }
  }, /*#__PURE__*/React.createElement(TopBar, {
    title: "Home"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "var(--text-display-size)",
      fontWeight: "var(--text-display-weight)",
      color: "var(--text-primary)",
      margin: "8px 0 20px"
    }
  }, "Hi, Mell!"), /*#__PURE__*/React.createElement(SegmentedControl, {
    options: ["My", "Family"],
    value: "My",
    style: {
      marginBottom: 20
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "var(--text-h2-size)",
      fontWeight: "var(--text-h2-weight)",
      color: "var(--text-primary)",
      marginBottom: 12
    }
  }, "Today"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: onOpenSuccess,
    style: {
      cursor: "pointer"
    }
  }, /*#__PURE__*/React.createElement(DoseCard, {
    name: "Atenolol",
    dosage: "50mg \xB7 1 tablet",
    time: "10 am",
    status: "pending"
  })), /*#__PURE__*/React.createElement(DoseCard, {
    name: "Metformin",
    dosage: "500mg \xB7 1 tablet",
    status: "taken"
  }), /*#__PURE__*/React.createElement(DoseCard, {
    name: "Vitamin D",
    dosage: "1000 IU \xB7 1 capsule",
    status: "missed"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "var(--text-h2-size)",
      fontWeight: "var(--text-h2-weight)",
      color: "var(--text-primary)",
      margin: "24px 0 12px"
    }
  }, "Family"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(ProgramCard, {
    memberName: "Mama Aisha",
    relation: "Mother",
    status: "due"
  }), /*#__PURE__*/React.createElement(ProgramCard, {
    memberName: "James",
    relation: "Father",
    status: "taken"
  })));
}
function CalendarScreen() {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "0 20px 100px",
      overflowY: "auto",
      height: "100%",
      boxSizing: "border-box"
    }
  }, /*#__PURE__*/React.createElement(TopBar, {
    title: "Calendar"
  }), /*#__PURE__*/React.createElement(Calendar, {
    monthLabel: "August 2026",
    today: 11,
    doseDays: [3, 11, 18, 25],
    style: {
      marginTop: 8,
      marginBottom: 20
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "var(--text-h2-size)",
      fontWeight: "var(--text-h2-weight)",
      color: "var(--text-primary)",
      marginBottom: 12
    }
  }, "August 11"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(DoseCard, {
    name: "Atenolol",
    dosage: "50mg \xB7 1 tablet",
    time: "10 am",
    status: "pending"
  }), /*#__PURE__*/React.createElement(DoseCard, {
    name: "Metformin",
    dosage: "500mg \xB7 1 tablet",
    time: "8 pm",
    status: "pending"
  })));
}
function FamilyScreen({
  onAdd
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "0 20px 100px",
      overflowY: "auto",
      height: "100%",
      boxSizing: "border-box",
      position: "relative"
    }
  }, /*#__PURE__*/React.createElement(TopBar, {
    title: "Family"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      height: 260,
      margin: "12px 0"
    }
  }, [1, 2].map(r => /*#__PURE__*/React.createElement("div", {
    key: r,
    style: {
      position: "absolute",
      top: "50%",
      left: "50%",
      width: 90 * r,
      height: 90 * r,
      marginLeft: -45 * r,
      marginTop: -45 * r,
      borderRadius: "50%",
      border: "2px dashed var(--border-light)"
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      top: "50%",
      left: "50%",
      width: 56,
      height: 56,
      marginLeft: -28,
      marginTop: -28,
      borderRadius: "50%",
      background: "var(--bg-card-alt)",
      border: "3px solid var(--color-primary)"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      top: "50%",
      left: "50%",
      width: 40,
      height: 40,
      marginLeft: -20 - 90,
      marginTop: -20,
      borderRadius: "50%",
      background: "var(--bg-card-alt)",
      border: "2px solid var(--bg-card)"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      top: "50%",
      left: "50%",
      width: 40,
      height: 40,
      marginLeft: 90 - 20,
      marginTop: -20,
      borderRadius: "50%",
      background: "var(--bg-card-alt)",
      border: "2px solid var(--bg-card)"
    }
  }), /*#__PURE__*/React.createElement(FAB, {
    icon: "plus",
    size: 48,
    onClick: onAdd,
    style: {
      position: "absolute",
      bottom: 0,
      left: 0
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--bg-card)",
      borderRadius: "var(--radius-lg) var(--radius-lg) 0 0",
      padding: "var(--space-4)",
      boxShadow: "var(--shadow-card)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "var(--text-body-strong-size)",
      fontWeight: 600,
      color: "var(--text-primary)",
      marginBottom: 12
    }
  }, "You have connected 2 family members."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement(ProgramCard, {
    memberName: "Mama Aisha",
    relation: "Mother",
    status: "due"
  }), /*#__PURE__*/React.createElement(ProgramCard, {
    memberName: "James",
    relation: "Father",
    status: "taken"
  }))));
}
function ProfileScreen() {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "0 20px 100px",
      overflowY: "auto",
      height: "100%",
      boxSizing: "border-box"
    }
  }, /*#__PURE__*/React.createElement(TopBar, {
    title: "Personal Info"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "center",
      margin: "8px 0 24px"
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    size: 88,
    editable: true
  })), /*#__PURE__*/React.createElement(FormField, {
    label: "Full Name",
    value: "Mell Johnson"
  }), /*#__PURE__*/React.createElement(FormField, {
    label: "Date of Birth",
    value: "14 March 1990"
  }), /*#__PURE__*/React.createElement(FormField, {
    label: "Phone",
    value: "+1 (555) 010-2938"
  }), /*#__PURE__*/React.createElement(FormField, {
    label: "Email",
    value: "mell.johnson@email.com"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "var(--text-h2-size)",
      fontWeight: "var(--text-h2-weight)",
      color: "var(--text-primary)",
      margin: "24px 0 12px"
    }
  }, "Notifications"), /*#__PURE__*/React.createElement(ListItem, {
    title: "Time to take Atenolol",
    timestamp: "5 minutes ago",
    type: "reminder"
  }), /*#__PURE__*/React.createElement(ListItem, {
    title: "You took Metformin",
    timestamp: "1 hour ago",
    type: "success"
  }), /*#__PURE__*/React.createElement(ListItem, {
    title: "Missed dose: Vitamin D",
    timestamp: "Yesterday",
    type: "warning",
    divider: false
  }));
}
function ScanScreen({
  scanned,
  onScan,
  onClose
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      height: "100%",
      background: "#16213A",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      position: "relative"
    },
    onClick: !scanned ? onScan : undefined
  }, /*#__PURE__*/React.createElement(ScanFrame, {
    resultName: scanned ? "Atenolol 50mg" : undefined,
    resultDetail: scanned ? "30 tablets · Blister pack" : undefined,
    style: {
      width: "100%",
      height: "100%",
      borderRadius: 0
    }
  }), !scanned && /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      bottom: 140,
      color: "#fff",
      fontSize: 13
    }
  }, "Tap to simulate a scan"), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    style: {
      position: "absolute",
      top: 20,
      left: 20,
      width: 32,
      height: 32,
      borderRadius: "50%",
      background: "rgba(255,255,255,0.25)",
      border: "none",
      color: "#fff",
      cursor: "pointer"
    }
  }, "\xD7"));
}
window.Screens = {
  HomeScreen,
  CalendarScreen,
  FamilyScreen,
  ProfileScreen,
  ScanScreen
};
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/medication-app/Screens.jsx", error: String((e && e.message) || e) }); }

// ui_kits/medication-app/Shell.jsx
try { (() => {
const {
  Icon
} = window.TheraHOMEDesignSystem_787051;
function PhoneFrame({
  children
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width: 375,
      height: 780,
      background: "var(--bg-app)",
      borderRadius: 40,
      boxShadow: "0 20px 60px rgba(22,33,58,0.25)",
      overflow: "hidden",
      position: "relative",
      fontFamily: "var(--font-family)"
    }
  }, children);
}
function TopBar({
  title,
  onBell
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      height: 56,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "0 20px"
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => window.__openDrawer && window.__openDrawer(),
    style: {
      background: "none",
      border: "none",
      cursor: "pointer"
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "menu",
    size: 22,
    color: "var(--text-primary)"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "var(--text-h1-size)",
      fontWeight: "var(--text-h1-weight)",
      color: "var(--text-primary)"
    }
  }, title), /*#__PURE__*/React.createElement("button", {
    onClick: onBell,
    style: {
      background: "none",
      border: "none",
      cursor: "pointer",
      position: "relative"
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "bell",
    size: 22,
    color: "var(--text-primary)"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      top: -2,
      right: -2,
      width: 8,
      height: 8,
      borderRadius: "50%",
      background: "var(--accent-orange)"
    }
  })));
}
window.PhoneFrame = PhoneFrame;
window.TopBar = TopBar;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/medication-app/Shell.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Button = __ds_scope.Button;

__ds_ns.FAB = __ds_scope.FAB;

__ds_ns.Calendar = __ds_scope.Calendar;

__ds_ns.DoseCard = __ds_scope.DoseCard;

__ds_ns.ProgramCard = __ds_scope.ProgramCard;

__ds_ns.SuccessCard = __ds_scope.SuccessCard;

__ds_ns.LabelChip = __ds_scope.LabelChip;

__ds_ns.SegmentedControl = __ds_scope.SegmentedControl;

__ds_ns.Avatar = __ds_scope.Avatar;

__ds_ns.FormField = __ds_scope.FormField;

__ds_ns.Icon = __ds_scope.Icon;

__ds_ns.ListItem = __ds_scope.ListItem;

__ds_ns.Drawer = __ds_scope.Drawer;

__ds_ns.TabBar = __ds_scope.TabBar;

__ds_ns.ScanFrame = __ds_scope.ScanFrame;

})();
