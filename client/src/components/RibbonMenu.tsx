import {
  Button,
  Menu,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  Select,
  mergeClasses,
  makeStyles,
  shorthands,
} from "@fluentui/react-components";
import type { ReactElement, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDownRegular,
  ClipboardPasteRegular,
  ClipboardPasteFilled,
  ScreenCutRegular,
  CopyRegular,
  TextBoldRegular,
  TextItalicRegular,
  TextUnderlineRegular,
  TextStrikethroughRegular,
  TextSubscriptRegular,
  TextSuperscriptRegular,
  BorderOutsideRegular,
  PaintBucketRegular,
  TextColorRegular,
  AlignTopRegular,
  AlignCenterVerticalRegular,
  AlignBottomRegular,
  TextboxRotate90Regular,
  TextWrapRegular,
  TextAlignLeftRegular,
  TextAlignCenterRegular,
  TextAlignRightRegular,
  TextAlignJustifyRegular,
  TextIndentDecreaseRegular,
  TextIndentIncreaseRegular,
  TableCellsMergeRegular,
  CurrencyDollarEuroRegular,
  TextPercentRegular,
  NumberSymbolRegular,
  TableCellEditRegular,
  PaintBrushRegular,
  TableRegular,
  DataBarVerticalRegular,
  MathFormulaRegular,
  AddCircleRegular,
  DeleteRegular,
  AutosumRegular,
  ArrowDownRegular,
  EraserRegular,
  ArrowSortRegular,
  ArrowSortDownLinesRegular,
  ArrowSortUpLinesRegular,
  FilterRegular,
  FilterDismissRegular,
  ArrowSyncRegular,
  ArrowUploadRegular,
  DatabaseRegular,
  LinkRegular,
  InfoRegular,
  EditRegular,
  TextColumnTwoRegular,
  WandRegular,
  DataFunnelRegular,
  ArrowTrendingRegular,
  ChevronUpRegular,
  GridRegular,
  PageFitRegular,
  WindowRegular,
  RulerRegular,
  ZoomInRegular,
  FullScreenMaximizeRegular,
  WindowNewRegular,
  LayoutRowTwoRegular,
  TableFreezeColumnRegular,
  EyeOffRegular,
  EyeRegular,
  SplitVerticalRegular,
  ArrowResetRegular,
  WindowMultipleRegular,
  CodeRegular,
  SearchRegular,
  SparkleRegular,
  DocumentRegular,
  TextGrammarCheckmarkRegular,
  BookRegular,
  SearchInfoRegular,
  AccessibilityRegular,
  TranslateRegular,
  CommentAddRegular,
  CommentDismissRegular,
  ArrowPreviousRegular,
  ArrowNextRegular,
  CommentRegular,
  CommentMultipleRegular,
  NoteRegular,
  LockClosedRegular,
  ShieldRegular,
  PeopleRegular,
  PenRegular,
} from "@fluentui/react-icons";

export interface RibbonProps {
  // Active state
  activeTab: string;
  onTabChange: (tab: string) => void;

  // Font state
  fontFamily: string;
  fontSize: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikethrough: boolean;

  // Alignment state
  horizontalAlign: "left" | "center" | "right" | "justify";
  verticalAlign: "top" | "middle" | "bottom";
  wrapText: boolean;

  // Number format state
  numberFormat: string;

  // Callbacks — clipboard
  onPaste: () => void;
  onCopy: () => void;
  onCut: () => void;

  // Callbacks — font
  onFontFamilyChange: (font: string) => void;
  onFontSizeChange: (size: number) => void;
  onBoldToggle: () => void;
  onItalicToggle: () => void;
  onUnderlineToggle: () => void;
  onStrikethroughToggle: () => void;
  onFontColorChange: (color: string) => void;
  onFillColorChange: (color: string) => void;

  // Callbacks — alignment
  onAlignLeft: () => void;
  onAlignCenter: () => void;
  onAlignRight: () => void;
  onAlignJustify: () => void;
  onAlignTop: () => void;
  onAlignMiddle: () => void;
  onAlignBottom: () => void;
  onWrapTextToggle: () => void;
  onMergeCells: () => void;

  // Callbacks — number
  onNumberFormatChange: (format: string) => void;
  onIncreaseDecimal: () => void;
  onDecreaseDecimal: () => void;

  // Callbacks — cells
  onInsertRow: () => void;
  onInsertColumn: () => void;
  onDeleteRow: () => void;
  onDeleteColumn: () => void;

  // Callbacks — editing
  onAutoSum: () => void;
  onSort: (direction: "asc" | "desc") => void;
  onFilter: () => void;
  onFind: () => void;
  onReplace: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onClearContents: () => void;

  // Callbacks — AI (Kenya specific)
  onAskAI: () => void;
  onAnalyze: () => void;
  onRegulatoryReturn: () => void;

  // Callbacks — view
  onZoomIn: () => void;
  onZoomOut: () => void;
  onToggleGridlines: () => void;
  onToggleFormulaBar: () => void;
  onFreezePanes: () => void;
  onToggleDarkMode: () => void;

  // State
  showGridlines: boolean;
  showFormulaBar: boolean;
  isDarkMode: boolean;
  canUndo: boolean;
  canRedo: boolean;
  zoom: number;
  collapsed?: boolean;

  /**
   * Catch-all for commands not covered by RibbonProps yet.
   * Used to keep the UI fully functional (no dead buttons).
   */
  onCommand?: (command: string) => void;
}

type TabId =
  | "file"
  | "home"
  | "insert"
  | "pageLayout"
  | "formulas"
  | "data"
  | "review"
  | "view";

const useStyles = makeStyles({
  root: {
    fontFamily: '"Segoe UI", system-ui, sans-serif',
    backgroundColor: "#f3f3f3",
    height: "135px",
    borderBottom: "1px solid #d1d1d1",
    display: "flex",
    flexDirection: "column",
    width: "100%",
  },
  tabRow: {
    height: "30px",
    display: "flex",
    alignItems: "stretch",
    backgroundColor: "#f3f3f3",
    color: "#111111",
    paddingLeft: "4px",
    paddingRight: "4px",
    gap: "2px",
  },
  tabButton: {
    height: "30px",
    padding: "0 16px",
    fontSize: "13px",
    color: "#111111",
    backgroundColor: "transparent",
    border: "none",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    userSelect: "none",
    ...shorthands.borderRadius(0),
  },
  tabButtonHover: {
    ":hover": { backgroundColor: "#e5f3ff" },
  },
  tabButtonActive: {
    backgroundColor: "#ffffff",
    color: "#217346",
    fontWeight: 600,
    borderTop: "2px solid #217346",
    borderLeft: "1px solid #d1d1d1",
    borderRight: "1px solid #d1d1d1",
  },
  commandRow: {
    height: "105px",
    backgroundColor: "#ffffff",
    padding: "2px 4px 0 4px",
    borderBottom: "1px solid #d1d1d1",
    display: "flex",
    alignItems: "stretch",
    overflowX: "auto",
    overflowY: "hidden",
  },
  commandRowInner: {
    display: "flex",
    alignItems: "stretch",
    height: "100%",
    width: "100%",
  },
  group: {
    display: "flex",
    flexDirection: "column",
    padding: "1px 4px 0 4px",
    borderRight: "1px solid #e1e1e1",
    minWidth: "fit-content",
    height: "100%",
  },
  groupBody: {
    display: "flex",
    flex: 1,
    alignItems: "flex-start",
    gap: "2px",
    minHeight: 0,
    overflow: "hidden",
  },
  groupLabel: {
    fontSize: "10px",
    color: "#444444",
    textAlign: "center",
    padding: "1px 0",
    lineHeight: 1.1,
  },
  largeButton: {
    width: "52px",
    height: "64px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
    border: "1px solid transparent",
    ...shorthands.borderRadius("4px"),
    cursor: "pointer",
    ":hover": { backgroundColor: "#e5f3ff" },
  },
  largeButtonActive: {
    backgroundColor: "#cce4ff",
    border: "1px solid #0078d4",
  },
  largeButtonIconWrap: {
    width: "32px",
    height: "32px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  largeButtonLabel: {
    fontSize: "11px",
    color: "#212121",
    marginTop: "2px",
    lineHeight: 1.1,
    whiteSpace: "nowrap",
  },
  smallButton: {
    width: "26px",
    height: "26px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
    border: "1px solid transparent",
    ...shorthands.borderRadius("3px"),
    cursor: "pointer",
    ":hover": { backgroundColor: "#e5f3ff" },
  },
  smallButtonActive: {
    backgroundColor: "#cce4ff",
    border: "1px solid #0078d4",
  },
  dropdown: {
    height: "20px",
    border: "1px solid #c8c8c8",
    backgroundColor: "#ffffff",
    fontFamily: '"Segoe UI", system-ui, sans-serif',
    fontSize: "12px",
    padding: "0 4px",
    ...shorthands.borderRadius("2px"),
  },
  // Excel-like dense sub-layouts (Home tab)
  clipboardStack: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    marginLeft: "2px",
  },
  fontStack: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },
  fontRow: {
    display: "flex",
    gap: "3px",
    alignItems: "center",
  },
  buttonCluster: {
    display: "inline-flex",
    gap: "1px",
    alignItems: "center",
    padding: "1px",
    ...shorthands.borderRadius("4px"),
  },
  alignmentGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 26px)",
    gridTemplateRows: "repeat(2, 26px)",
    columnGap: "2px",
    rowGap: "2px",
    alignItems: "center",
    justifyItems: "center",
  },
  colorBar: {
    width: "16px",
    height: "3px",
    marginTop: "2px",
    backgroundColor: "currentColor",
  },
  splitButton: {
    display: "flex",
    width: "52px",
    height: "64px",
    border: "1px solid transparent",
    ...shorthands.borderRadius("4px"),
    overflow: "hidden",
    backgroundColor: "transparent",
    ":hover": { backgroundColor: "#e5f3ff" },
  },
  splitMain: {
    flex: 1,
    border: "none",
    backgroundColor: "transparent",
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
  },
  splitArrow: {
    width: "18px",
    borderLeft: "1px solid #d1d1d1",
    borderTop: "none",
    borderRight: "none",
    borderBottom: "none",
    backgroundColor: "transparent",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  chevron: {
    fontSize: "10px",
    lineHeight: 1,
  },
});

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
    return (
    tag === "input" ||
    tag === "textarea" ||
    target.isContentEditable ||
    target.getAttribute("role") === "textbox"
  );
}

function LargeButton({
  icon,
  label,
  onClick,
  active,
  disabled,
}: {
  icon: ReactElement;
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  const styles = useStyles();
  return (
        <Button
      appearance="transparent"
      size="small"
      disabled={disabled}
      onClick={onClick}
      className={mergeClasses(styles.largeButton, active ? styles.largeButtonActive : undefined)}
    >
      <span className={styles.largeButtonIconWrap}>{icon}</span>
      <span className={styles.largeButtonLabel}>{label}</span>
        </Button>
  );
}

function cmd(props: RibbonProps, command: string): void {
  props.onCommand?.(command);
}

function SmallButton({
  icon,
  title,
  onClick,
  active,
  disabled,
}: {
  icon: ReactElement;
  title: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  const styles = useStyles();
  return (
        <Button
      appearance="transparent"
      size="small"
      disabled={disabled}
      title={title}
      onClick={onClick}
      className={mergeClasses(styles.smallButton, active ? styles.smallButtonActive : undefined)}
    >
      {icon}
        </Button>
  );
}

function Group({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const styles = useStyles();
  return (
    <div className={styles.group}>
      <div className={styles.groupBody}>{children}</div>
      <div className={styles.groupLabel}>{label}</div>
    </div>
  );
}

function ColorSmallButton({
  title,
  color,
  icon,
  onClick,
}: {
  title: string;
  color: string;
  icon: ReactElement;
  onClick: () => void;
}) {
  const styles = useStyles();
  return (
            <Button
      appearance="transparent"
      size="small"
      title={title}
      onClick={onClick}
      className={styles.smallButton}
    >
      <span style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        {icon}
        <span className={styles.colorBar} style={{ backgroundColor: color }} />
            </span>
            </Button>
  );
}

function PasteSplitButton({
  onPaste,
}: {
  onPaste: () => void;
}) {
  const styles = useStyles();
  return (
    <Menu positioning="below-start">
      <div className={styles.splitButton}>
        <button type="button" className={styles.splitMain} onClick={onPaste} title="Paste (Ctrl+V)">
          <span className={styles.largeButtonIconWrap}>
            <ClipboardPasteRegular style={{ fontSize: 32 }} />
          </span>
          <span className={styles.largeButtonLabel}>Paste</span>
        </button>
        <MenuTrigger disableButtonEnhancement>
          <button type="button" className={styles.splitArrow} aria-label="Paste options">
            <ChevronDownRegular className={styles.chevron} />
          </button>
        </MenuTrigger>
          </div>
      <MenuPopover>
        <MenuList>
          <MenuItem icon={<ClipboardPasteRegular />} onClick={onPaste}>
            Paste
          </MenuItem>
          <MenuItem icon={<ClipboardPasteFilled />} onClick={onPaste}>
            Paste Special
          </MenuItem>
          <MenuItem icon={<NumberSymbolRegular />} onClick={onPaste}>
            Paste as Values
          </MenuItem>
        </MenuList>
      </MenuPopover>
    </Menu>
  );
}

export function RibbonMenu(props: RibbonProps) {
  const styles = useStyles();
  const commandRowRef = useRef<HTMLDivElement | null>(null);
  const tabs = useMemo(
    (): { id: TabId; label: string }[] => [
      { id: "file", label: "File" },
      { id: "home", label: "Home" },
      { id: "insert", label: "Insert" },
      { id: "pageLayout", label: "Page Layout" },
      { id: "formulas", label: "Formulas" },
      { id: "data", label: "Data" },
      { id: "review", label: "Review" },
      { id: "view", label: "View" },
    ],
    []
  );

  const activeTabId: TabId =
    (tabs.find((t: { id: TabId; label: string }) => t.id === (props.activeTab as TabId))?.id ?? "home");

  useEffect(() => {
    // Keep the start of the ribbon visible when changing tabs
    // (prevents starting on the far-right groups like Styles/Cells).
    commandRowRef.current?.scrollTo({ left: 0 });
  }, [activeTabId]);

  const fontFamilies = useMemo(
    () => ["Calibri", "Arial", "Times New Roman", "Verdana"],
    []
  );
  const fontSizes = useMemo(
    () => [8, 9, 10, 11, 12, 14, 16, 18, 20, 24],
    []
  );
  const numberFormats = useMemo(
    () => [
      "General",
      "Number",
      "Currency",
      "Accounting",
      "Short Date",
      "Long Date",
      "Time",
      "Percentage",
      "Fraction",
      "Scientific",
      "Text",
    ],
    []
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;

      const key = e.key;
      const ctrl = e.ctrlKey || e.metaKey;
      const shift = e.shiftKey;

      // Clipboard
      if (ctrl && !shift && (key === "v" || key === "V")) {
        e.preventDefault();
        props.onPaste();
        return;
      }
      if (ctrl && !shift && (key === "c" || key === "C")) {
        e.preventDefault();
        props.onCopy();
        return;
      }
      if (ctrl && !shift && (key === "x" || key === "X")) {
        e.preventDefault();
        props.onCut();
        return;
      }

      // Undo/redo
      if (ctrl && !shift && (key === "z" || key === "Z")) {
        e.preventDefault();
        props.onUndo();
        return;
      }
      if (ctrl && !shift && (key === "y" || key === "Y")) {
        e.preventDefault();
        props.onRedo();
        return;
      }

      // Find/replace
      if (ctrl && !shift && (key === "f" || key === "F")) {
        e.preventDefault();
        props.onFind();
        return;
      }
      if (ctrl && !shift && (key === "h" || key === "H")) {
        e.preventDefault();
        props.onReplace();
        return;
      }
      if (ctrl && shift && (key === "L" || key === "l")) {
        e.preventDefault();
        props.onFilter();
        return;
      }

      // Alignment
      if (ctrl && !shift && (key === "l" || key === "L")) {
        e.preventDefault();
        props.onAlignLeft();
        return;
      }
      if (ctrl && !shift && (key === "e" || key === "E")) {
        e.preventDefault();
        props.onAlignCenter();
        return;
      }
      if (ctrl && !shift && (key === "r" || key === "R")) {
        e.preventDefault();
        props.onAlignRight();
        return;
      }

      // Font toggles
      if (ctrl && !shift && (key === "b" || key === "B")) {
        e.preventDefault();
        props.onBoldToggle();
        return;
      }
      if (ctrl && !shift && (key === "i" || key === "I")) {
        e.preventDefault();
        props.onItalicToggle();
        return;
      }
      if (ctrl && !shift && (key === "u" || key === "U")) {
        e.preventDefault();
        props.onUnderlineToggle();
        return;
      }
      if (ctrl && !shift && (key === "5")) {
        e.preventDefault();
        props.onStrikethroughToggle();
        return;
      }

      // Number formats
      if (ctrl && shift && key === "%") {
        e.preventDefault();
        props.onNumberFormatChange("Percentage");
        return;
      }
      if (ctrl && shift && key === "!") {
        e.preventDefault();
        props.onNumberFormatChange("Number");
        return;
      }
      if (ctrl && shift && key === "$") {
        e.preventDefault();
        props.onNumberFormatChange("Currency (KSh)");
        return;
      }

      // Show formulas
      if (ctrl && !shift && key === "`") {
        e.preventDefault();
        // Closest available callback in RibbonProps
        props.onToggleFormulaBar();
        return;
      }

      // AutoSum
      if (e.altKey && key === "=") {
        e.preventDefault();
        props.onAutoSum();
        return;
      }

      // Clear
      if (key === "Delete") {
        e.preventDefault();
        props.onClearContents();
        return;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [props]);

  return (
    <div
      className={styles.root}
      style={{ height: props.collapsed ? "30px" : "135px" }}
    >
      <div className={styles.tabRow}>
        {tabs.map((tab: { id: TabId; label: string }) => {
          const isActive = activeTabId === tab.id;
          return (
          <button
            key={tab.id}
              type="button"
              onClick={() => props.onTabChange(tab.id)}
              className={`${styles.tabButton} ${styles.tabButtonHover} ${isActive ? styles.tabButtonActive : ""}`}
          >
            {tab.label}
          </button>
          );
        })}
      </div>

      {!props.collapsed && <div ref={commandRowRef} className={styles.commandRow}>
        <div className={styles.commandRowInner}>
          {activeTabId === "home" && (
            <>
            <Group label="Clipboard">
              <PasteSplitButton onPaste={props.onPaste} />
              <div className={styles.clipboardStack}>
                <SmallButton
                  icon={<ScreenCutRegular style={{ fontSize: 16 }} />}
                title="Cut (Ctrl+X)"
                  onClick={props.onCut}
                />
                <SmallButton
                  icon={<CopyRegular style={{ fontSize: 16 }} />}
                title="Copy (Ctrl+C)"
                  onClick={props.onCopy}
                />
                <SmallButton
                  icon={<PaintBrushRegular style={{ fontSize: 16 }} />}
                  title="Format Painter (Ctrl+Shift+C)"
                  onClick={() => cmd(props, "home.clipboard.formatPainter")}
                />
            </div>
            </Group>

            <Group label="Font">
              <div className={styles.fontStack}>
                <div className={styles.fontRow}>
                  <Select
                    value={props.fontFamily}
                    className={styles.dropdown}
                    style={{ width: 130 }}
                    onChange={(_, data) => props.onFontFamilyChange(String(data.value))}
                  >
                    {fontFamilies.map((f: string) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </Select>
                  <Select
                    value={String(props.fontSize)}
                    className={styles.dropdown}
                    style={{ width: 48 }}
                    onChange={(_, data) => props.onFontSizeChange(Number(data.value))}
                  >
                    {fontSizes.map((s: number) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className={styles.fontRow} style={{ gap: 2 }}>
                  <div className={styles.buttonCluster}>
                    <SmallButton
                      icon={<TextBoldRegular style={{ fontSize: 16 }} />}
              title="Bold (Ctrl+B)"
                      onClick={props.onBoldToggle}
                      active={props.bold}
                    />
                    <SmallButton
                      icon={<TextItalicRegular style={{ fontSize: 16 }} />}
              title="Italic (Ctrl+I)"
                      onClick={props.onItalicToggle}
                      active={props.italic}
                    />
                    <SmallButton
                      icon={<TextUnderlineRegular style={{ fontSize: 16 }} />}
              title="Underline (Ctrl+U)"
                      onClick={props.onUnderlineToggle}
                      active={props.underline}
                    />
                  </div>
                  <div className={styles.buttonCluster}>
                    <ColorSmallButton
                      title="Fill Color (Alt+H+H)"
                      color="#ffff00"
                      icon={<PaintBucketRegular style={{ fontSize: 16 }} />}
                      onClick={() => props.onFillColorChange("#ffff00")}
                    />
                    <ColorSmallButton
                      title="Font Color (Alt+H+FC)"
                      color="#000000"
                      icon={<TextColorRegular style={{ fontSize: 16 }} />}
                      onClick={() => props.onFontColorChange("#000000")}
                    />
                </div>
                  <Menu positioning="below-start">
                    <MenuTrigger disableButtonEnhancement>
                      <span>
                        <SmallButton
                          icon={<BorderOutsideRegular style={{ fontSize: 16 }} />}
                          title="Borders"
                          onClick={() => cmd(props, "home.font.borders")}
                        />
                      </span>
                    </MenuTrigger>
                    <MenuPopover>
                      <MenuList>
                        <MenuItem icon={<BorderOutsideRegular />} onClick={() => cmd(props, "home.font.borders.outside")}>
                          Outside Borders
                        </MenuItem>
                        <MenuItem icon={<BorderOutsideRegular />} onClick={() => cmd(props, "home.font.borders.all")}>
                          All Borders
                        </MenuItem>
                        <MenuItem icon={<BorderOutsideRegular />} onClick={() => cmd(props, "home.font.borders.none")}>
                          No Border
                        </MenuItem>
                      </MenuList>
                    </MenuPopover>
                  </Menu>
                  </div>
                </div>
            </Group>

            <Group label="Alignment">
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <div className={styles.alignmentGrid}>
                  <SmallButton
                    icon={<TextAlignLeftRegular style={{ fontSize: 16 }} />}
                    title="Align Left (Ctrl+L)"
                    onClick={props.onAlignLeft}
                    active={props.horizontalAlign === "left"}
                  />
                  <SmallButton
                    icon={<TextAlignCenterRegular style={{ fontSize: 16 }} />}
                    title="Center (Ctrl+E)"
                    onClick={props.onAlignCenter}
                    active={props.horizontalAlign === "center"}
                  />
                  <SmallButton
                    icon={<TextAlignRightRegular style={{ fontSize: 16 }} />}
                    title="Align Right (Ctrl+R)"
                    onClick={props.onAlignRight}
                    active={props.horizontalAlign === "right"}
                  />
                  <SmallButton
                    icon={<AlignTopRegular style={{ fontSize: 16 }} />}
                    title="Top Align"
                    onClick={props.onAlignTop}
                    active={props.verticalAlign === "top"}
                  />
                  <SmallButton
                    icon={<AlignCenterVerticalRegular style={{ fontSize: 16 }} />}
                    title="Middle Align"
                    onClick={props.onAlignMiddle}
                    active={props.verticalAlign === "middle"}
                  />
                  <SmallButton
                    icon={<AlignBottomRegular style={{ fontSize: 16 }} />}
                    title="Bottom Align"
                    onClick={props.onAlignBottom}
                    active={props.verticalAlign === "bottom"}
                  />
            </div>
                <div className={styles.fontRow} style={{ gap: 2 }}>
                  <SmallButton
                    icon={<TextWrapRegular style={{ fontSize: 16 }} />}
                    title="Wrap Text (Alt+H+W)"
                    onClick={props.onWrapTextToggle}
                    active={props.wrapText}
                  />
                  <SmallButton
                    icon={<TextIndentDecreaseRegular style={{ fontSize: 16 }} />}
                    title="Decrease Indent (Ctrl+Shift+M)"
                    onClick={() => cmd(props, "home.alignment.indentDecrease")}
                  />
                  <SmallButton
                    icon={<TextIndentIncreaseRegular style={{ fontSize: 16 }} />}
                    title="Increase Indent (Ctrl+M)"
                    onClick={() => cmd(props, "home.alignment.indentIncrease")}
                  />
                  <Menu positioning="below-start">
                    <MenuTrigger disableButtonEnhancement>
                      <span>
                        <SmallButton
                          icon={<TextboxRotate90Regular style={{ fontSize: 16 }} />}
                          title="Orientation"
                          onClick={() => {}}
                        />
                      </span>
                    </MenuTrigger>
                    <MenuPopover>
                      <MenuList>
                        <MenuItem>Rotate Text Up</MenuItem>
                        <MenuItem>Rotate Text Down</MenuItem>
                        <MenuItem>Format Cell Alignment…</MenuItem>
                      </MenuList>
                    </MenuPopover>
                  </Menu>
            </div>
                <Menu positioning="below-start">
                  <MenuTrigger disableButtonEnhancement>
                    <span>
                      <Button appearance="transparent" size="small" className={styles.largeButton} onClick={props.onMergeCells}>
                        <span className={styles.largeButtonIconWrap}>
                          <TableCellsMergeRegular style={{ fontSize: 32 }} />
                        </span>
                        <span className={styles.largeButtonLabel}>Merge &amp; Center</span>
            </Button>
                    </span>
                  </MenuTrigger>
                  <MenuPopover>
                    <MenuList>
                      <MenuItem onClick={props.onMergeCells}>Merge &amp; Center</MenuItem>
                      <MenuItem onClick={props.onMergeCells}>Merge Across</MenuItem>
                      <MenuItem onClick={props.onMergeCells}>Merge Cells</MenuItem>
                      <MenuItem onClick={props.onMergeCells}>Unmerge Cells</MenuItem>
                    </MenuList>
                  </MenuPopover>
                </Menu>
          </div>
            </Group>

            <Group label="Number">
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <Select
                  value={props.numberFormat}
                  className={styles.dropdown}
                  style={{ width: 120 }}
                  onChange={(_, data) => props.onNumberFormatChange(String(data.value))}
                >
                  {numberFormats.map((f: string) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </Select>
                <div style={{ display: "flex", gap: 2 }}>
                  <Menu positioning="below-start">
                    <MenuTrigger disableButtonEnhancement>
                      <span>
                        <SmallButton
                          icon={<CurrencyDollarEuroRegular style={{ fontSize: 16 }} />}
                          title="Accounting Format (Ctrl+Shift+$)"
                          onClick={() => props.onNumberFormatChange("Currency (KSh)")}
                        />
                      </span>
                    </MenuTrigger>
                    <MenuPopover>
                      <MenuList>
                        <MenuItem onClick={() => props.onNumberFormatChange("Currency ($)")}>$</MenuItem>
                        <MenuItem onClick={() => props.onNumberFormatChange("Currency (£)")}>£</MenuItem>
                        <MenuItem onClick={() => props.onNumberFormatChange("Currency (€)")}>€</MenuItem>
                        <MenuItem onClick={() => props.onNumberFormatChange("Currency (KSh)")}>KSh</MenuItem>
                      </MenuList>
                    </MenuPopover>
                  </Menu>
                  <SmallButton
                    icon={<TextPercentRegular style={{ fontSize: 16 }} />}
                    title="Percent Style (Ctrl+Shift+%)"
                    onClick={() => props.onNumberFormatChange("Percentage")}
                  />
                  <SmallButton
                    icon={<NumberSymbolRegular style={{ fontSize: 16 }} />}
                    title="Comma Style (Ctrl+Shift+!)"
                    onClick={() => props.onNumberFormatChange("Number")}
                  />
                </div>
                <div style={{ display: "flex", gap: 2 }}>
                  <SmallButton
                    icon={<NumberSymbolRegular style={{ fontSize: 16 }} />}
              title="Increase Decimal"
                    onClick={props.onIncreaseDecimal}
                  />
                  <SmallButton
                    icon={<NumberSymbolRegular style={{ fontSize: 16 }} />}
                    title="Decrease Decimal"
                    onClick={props.onDecreaseDecimal}
                  />
          </div>
              </div>
            </Group>

            <Group label="Styles">
              <div style={{ display: "flex", gap: 6 }}>
                <Menu positioning="below-start">
                  <MenuTrigger disableButtonEnhancement>
                    <span>
                      <LargeButton
                        icon={<TableCellEditRegular style={{ fontSize: 32 }} />}
                        label="Conditional"
                        onClick={() => {}}
                      />
                    </span>
                  </MenuTrigger>
                  <MenuPopover>
                    <MenuList>
                      <MenuItem>Highlight Cell Rules</MenuItem>
                      <MenuItem>Top/Bottom Rules</MenuItem>
                      <MenuItem>Data Bars</MenuItem>
                      <MenuItem>Color Scales</MenuItem>
                      <MenuItem>Icon Sets</MenuItem>
                      <MenuItem>New Rule…</MenuItem>
                      <MenuItem>Clear Rules</MenuItem>
                      <MenuItem>Manage Rules…</MenuItem>
                    </MenuList>
                  </MenuPopover>
                </Menu>
                <Menu positioning="below-start">
                  <MenuTrigger disableButtonEnhancement>
                    <span>
                      <LargeButton
                        icon={<TableRegular style={{ fontSize: 32 }} />}
                        label="Format Table"
                        onClick={() => {}}
                      />
                    </span>
                  </MenuTrigger>
                  <MenuPopover>
                    <MenuList>
                      <MenuItem>Light</MenuItem>
                      <MenuItem>Medium</MenuItem>
                      <MenuItem>Dark</MenuItem>
                    </MenuList>
                  </MenuPopover>
                </Menu>
                <Menu positioning="below-start">
                  <MenuTrigger disableButtonEnhancement>
                    <span>
                      <LargeButton
                        icon={<PaintBrushRegular style={{ fontSize: 32 }} />}
                        label="Cell Styles"
                        onClick={() => {}}
                      />
                    </span>
                  </MenuTrigger>
                  <MenuPopover>
                    <MenuList>
                      <MenuItem>Normal</MenuItem>
                      <MenuItem>Good</MenuItem>
                      <MenuItem>Bad</MenuItem>
                      <MenuItem>Neutral</MenuItem>
                    </MenuList>
                  </MenuPopover>
                </Menu>
          </div>
            </Group>

            <Group label="Cells">
              <div style={{ display: "flex", gap: 6 }}>
                <Menu positioning="below-start">
                  <MenuTrigger disableButtonEnhancement>
                    <span>
                      <LargeButton icon={<AddCircleRegular style={{ fontSize: 32 }} />} label="Insert" onClick={props.onInsertRow} />
                    </span>
                  </MenuTrigger>
                  <MenuPopover>
                    <MenuList>
                      <MenuItem onClick={props.onInsertRow}>Insert Sheet Rows</MenuItem>
                      <MenuItem onClick={props.onInsertColumn}>Insert Sheet Columns</MenuItem>
                    </MenuList>
                  </MenuPopover>
                </Menu>
                <Menu positioning="below-start">
                  <MenuTrigger disableButtonEnhancement>
                    <span>
                      <LargeButton icon={<DeleteRegular style={{ fontSize: 32 }} />} label="Delete" onClick={props.onDeleteRow} />
                    </span>
                  </MenuTrigger>
                  <MenuPopover>
                    <MenuList>
                      <MenuItem onClick={props.onDeleteRow}>Delete Sheet Rows</MenuItem>
                      <MenuItem onClick={props.onDeleteColumn}>Delete Sheet Columns</MenuItem>
                    </MenuList>
                  </MenuPopover>
                </Menu>
                <Menu positioning="below-start">
                  <MenuTrigger disableButtonEnhancement>
                    <span>
                      <LargeButton icon={<DocumentRegular style={{ fontSize: 32 }} />} label="Format" onClick={props.onMergeCells} />
                    </span>
                  </MenuTrigger>
                  <MenuPopover>
                    <MenuList>
                      <MenuItem>Row Height…</MenuItem>
                      <MenuItem>Column Width…</MenuItem>
                      <MenuItem>Hide &amp; Unhide</MenuItem>
                    </MenuList>
                  </MenuPopover>
                </Menu>
        </div>
            </Group>

            <Group label="Editing">
              <div style={{ display: "flex", gap: 6 }}>
                <Menu positioning="below-start">
                  <MenuTrigger disableButtonEnhancement>
                    <span>
                      <LargeButton icon={<AutosumRegular style={{ fontSize: 32 }} />} label="AutoSum" onClick={props.onAutoSum} />
                    </span>
                  </MenuTrigger>
                  <MenuPopover>
                    <MenuList>
                      <MenuItem onClick={props.onAutoSum}>Sum</MenuItem>
                      <MenuItem onClick={props.onAutoSum}>Average</MenuItem>
                      <MenuItem onClick={props.onAutoSum}>Count</MenuItem>
                      <MenuItem onClick={props.onAutoSum}>Max</MenuItem>
                      <MenuItem onClick={props.onAutoSum}>Min</MenuItem>
                    </MenuList>
                  </MenuPopover>
                </Menu>
                <Menu positioning="below-start">
                  <MenuTrigger disableButtonEnhancement>
                    <span>
                      <LargeButton icon={<ArrowDownRegular style={{ fontSize: 32 }} />} label="Fill" onClick={() => {}} />
                    </span>
                  </MenuTrigger>
                  <MenuPopover>
                    <MenuList>
                      <MenuItem>Down</MenuItem>
                      <MenuItem>Right</MenuItem>
                      <MenuItem>Up</MenuItem>
                      <MenuItem>Left</MenuItem>
                    </MenuList>
                  </MenuPopover>
                </Menu>
                <Menu positioning="below-start">
                  <MenuTrigger disableButtonEnhancement>
                    <span>
                      <LargeButton icon={<EraserRegular style={{ fontSize: 32 }} />} label="Clear" onClick={props.onClearContents} />
                    </span>
                  </MenuTrigger>
                  <MenuPopover>
                    <MenuList>
                      <MenuItem onClick={props.onClearContents}>Clear All</MenuItem>
                      <MenuItem onClick={props.onClearContents}>Clear Formats</MenuItem>
                      <MenuItem onClick={props.onClearContents}>Clear Contents</MenuItem>
                    </MenuList>
                  </MenuPopover>
                </Menu>
                <Menu positioning="below-start">
                  <MenuTrigger disableButtonEnhancement>
                    <span>
                      <LargeButton icon={<ArrowSortRegular style={{ fontSize: 32 }} />} label="Sort" onClick={() => props.onSort("asc")} />
                    </span>
                  </MenuTrigger>
                  <MenuPopover>
                    <MenuList>
                      <MenuItem onClick={() => props.onSort("asc")}>Sort A to Z</MenuItem>
                      <MenuItem onClick={() => props.onSort("desc")}>Sort Z to A</MenuItem>
                      <MenuItem onClick={props.onFilter}>Filter</MenuItem>
                      <MenuItem onClick={props.onFilter}>Clear</MenuItem>
                    </MenuList>
                  </MenuPopover>
                </Menu>
                <Menu positioning="below-start">
                  <MenuTrigger disableButtonEnhancement>
                    <span>
                      <LargeButton icon={<SearchRegular style={{ fontSize: 32 }} />} label="Find" onClick={props.onFind} />
                    </span>
                  </MenuTrigger>
                  <MenuPopover>
                    <MenuList>
                      <MenuItem onClick={props.onFind}>Find</MenuItem>
                      <MenuItem onClick={props.onReplace}>Replace</MenuItem>
                      <MenuItem>Go To…</MenuItem>
                    </MenuList>
                  </MenuPopover>
                </Menu>
        </div>
            </Group>

            <Group label="AI Tools">
              <div style={{ display: "flex", gap: 6 }}>
          <Button
                  appearance="secondary"
                  onClick={props.onAskAI}
                  style={{
                    width: 52,
                    height: 64,
                    borderRadius: 4,
                  }}
                >
                  <span className={styles.largeButtonIconWrap}>
                    <SparkleRegular style={{ fontSize: 32 }} />
                  </span>
                  <span className={styles.largeButtonLabel}>
                    Ask AI
                  </span>
          </Button>
                <LargeButton
                  icon={<DataBarVerticalRegular style={{ fontSize: 32 }} />}
                  label="Analyze"
                  onClick={props.onAnalyze}
                />
                <LargeButton
                  icon={<DocumentRegular style={{ fontSize: 32 }} />}
                  label="Regulatory"
                  onClick={props.onRegulatoryReturn}
                />
        </div>
            </Group>
            </>
          )}

          {activeTabId === "insert" && (
            <>
              <Group label="Tables">
                <LargeButton icon={<TableRegular style={{ fontSize: 32 }} />} label="Table" onClick={() => cmd(props, "insert.tables.table")} />
                <LargeButton icon={<TableRegular style={{ fontSize: 32 }} />} label="PivotTable" onClick={() => cmd(props, "insert.tables.pivotTable")} />
              </Group>
              <Group label="Links">
                <LargeButton icon={<LinkRegular style={{ fontSize: 32 }} />} label="Link" onClick={() => cmd(props, "insert.links.link")} />
              </Group>
              <Group label="Symbols">
                <LargeButton icon={<MathFormulaRegular style={{ fontSize: 32 }} />} label="Equation" onClick={() => cmd(props, "insert.symbols.equation")} />
              </Group>
            </>
          )}

          {activeTabId === "pageLayout" && (
            <>
              <Group label="Page Setup">
                <LargeButton icon={<LayoutRowTwoRegular style={{ fontSize: 32 }} />} label="Margins" onClick={() => cmd(props, "pageLayout.pageSetup.margins")} />
                <LargeButton icon={<SplitVerticalRegular style={{ fontSize: 32 }} />} label="Orientation" onClick={() => cmd(props, "pageLayout.pageSetup.orientation")} />
              </Group>
              <Group label="Sheet Options">
                <LargeButton
                  icon={<GridRegular style={{ fontSize: 32 }} />}
                  label="Gridlines"
                  onClick={props.onToggleGridlines}
                  active={props.showGridlines}
                />
              </Group>
            </>
          )}

          {activeTabId === "formulas" && (
            <>
              <Group label="Function Library">
                <LargeButton icon={<MathFormulaRegular style={{ fontSize: 32 }} />} label="Insert Function" onClick={() => cmd(props, "formulas.functionLibrary.insertFunction")} />
                <LargeButton
                  icon={<AutosumRegular style={{ fontSize: 32 }} />}
                  label="AutoSum"
                  onClick={props.onAutoSum}
                />
              </Group>
              <Group label="Formula Auditing">
                <LargeButton
                  icon={<CodeRegular style={{ fontSize: 32 }} />}
                  label="Show Formulas"
                  onClick={props.onToggleFormulaBar}
                  active={props.showFormulaBar}
                />
              </Group>
              <Group label="Calculation">
                <LargeButton icon={<DocumentRegular style={{ fontSize: 32 }} />} label="Calculate" onClick={() => cmd(props, "formulas.calculation.calculate")} />
              </Group>
            </>
          )}

          {activeTabId === "data" && (
            <>
              <Group label="Get & Transform">
                <LargeButton icon={<DatabaseRegular style={{ fontSize: 32 }} />} label="Get Data" onClick={() => cmd(props, "data.getTransform.getData")} />
                <LargeButton icon={<ArrowSyncRegular style={{ fontSize: 32 }} />} label="Refresh All" onClick={() => cmd(props, "data.getTransform.refreshAll")} />
              </Group>
              <Group label="Queries">
                <LargeButton icon={<LinkRegular style={{ fontSize: 32 }} />} label="Connections" onClick={() => cmd(props, "data.queries.connections")} />
                <SmallButton icon={<InfoRegular style={{ fontSize: 16 }} />} title="Properties" onClick={() => cmd(props, "data.queries.properties")} />
                <SmallButton icon={<EditRegular style={{ fontSize: 16 }} />} title="Edit Links" onClick={() => cmd(props, "data.queries.editLinks")} />
              </Group>
              <Group label="Sort & Filter">
                <div style={{ display: "flex", gap: 6 }}>
                  <LargeButton
                    icon={<ArrowSortDownLinesRegular style={{ fontSize: 32 }} />}
                    label="Sort A-Z"
                    onClick={() => props.onSort("asc")}
                  />
                  <LargeButton
                    icon={<ArrowSortUpLinesRegular style={{ fontSize: 32 }} />}
                    label="Sort Z-A"
                    onClick={() => props.onSort("desc")}
                  />
                  <LargeButton
                    icon={<FilterRegular style={{ fontSize: 32 }} />}
                    label="Filter"
                    onClick={props.onFilter}
                  />
                  <LargeButton
                    icon={<FilterDismissRegular style={{ fontSize: 32 }} />}
                    label="Clear"
                    onClick={props.onFilter}
                  />
        </div>
              </Group>
              <Group label="Data Tools">
                <div style={{ display: "flex", gap: 6 }}>
                  <LargeButton
                    icon={<TextColumnTwoRegular style={{ fontSize: 32 }} />}
                    label="Text to Columns"
                    onClick={() => cmd(props, "data.dataTools.textToColumns")}
                  />
                  <LargeButton
                    icon={<WandRegular style={{ fontSize: 32 }} />}
                    label="Flash Fill"
                    onClick={() => cmd(props, "data.dataTools.flashFill")}
                  />
                  <LargeButton
                    icon={<DeleteRegular style={{ fontSize: 32 }} />}
                    label="Remove Duplicates"
                    onClick={props.onClearContents}
                  />
                </div>
              </Group>
            </>
          )}

          {activeTabId === "review" && (
            <>
              <Group label="Proofing">
                <LargeButton icon={<TextGrammarCheckmarkRegular style={{ fontSize: 32 }} />} label="Spelling" onClick={() => cmd(props, "review.proofing.spelling")} />
                <LargeButton icon={<BookRegular style={{ fontSize: 32 }} />} label="Thesaurus" onClick={() => cmd(props, "review.proofing.thesaurus")} />
                <LargeButton icon={<SearchInfoRegular style={{ fontSize: 32 }} />} label="Smart Lookup" onClick={() => cmd(props, "review.proofing.smartLookup")} />
              </Group>
              <Group label="Accessibility">
                <LargeButton icon={<AccessibilityRegular style={{ fontSize: 32 }} />} label="Check" onClick={() => cmd(props, "review.accessibility.check")} />
              </Group>
              <Group label="Language">
                <LargeButton icon={<TranslateRegular style={{ fontSize: 32 }} />} label="Translate" onClick={() => cmd(props, "review.language.translate")} />
              </Group>
              <Group label="Comments">
                <LargeButton icon={<CommentAddRegular style={{ fontSize: 32 }} />} label="New" onClick={() => cmd(props, "review.comments.new")} />
                <SmallButton icon={<CommentDismissRegular style={{ fontSize: 16 }} />} title="Delete" onClick={() => cmd(props, "review.comments.delete")} />
                <SmallButton icon={<ArrowPreviousRegular style={{ fontSize: 16 }} />} title="Previous" onClick={() => cmd(props, "review.comments.prev")} />
                <SmallButton icon={<ArrowNextRegular style={{ fontSize: 16 }} />} title="Next" onClick={() => cmd(props, "review.comments.next")} />
              </Group>
              <Group label="Protect">
                <LargeButton icon={<LockClosedRegular style={{ fontSize: 32 }} />} label="Protect" onClick={() => cmd(props, "review.protect.sheet")} />
                <LargeButton icon={<ShieldRegular style={{ fontSize: 32 }} />} label="Workbook" onClick={() => cmd(props, "review.protect.workbook")} />
              </Group>
            </>
          )}

          {activeTabId === "view" && (
            <>
              <Group label="Workbook Views">
                <LargeButton icon={<GridRegular style={{ fontSize: 32 }} />} label="Normal" onClick={() => cmd(props, "view.workbookViews.normal")} />
                <LargeButton icon={<DocumentRegular style={{ fontSize: 32 }} />} label="Page Break" onClick={() => cmd(props, "view.workbookViews.pageBreak")} />
                <LargeButton icon={<PageFitRegular style={{ fontSize: 32 }} />} label="Layout" onClick={() => cmd(props, "view.workbookViews.pageLayout")} />
                <LargeButton icon={<WindowRegular style={{ fontSize: 32 }} />} label="Views" onClick={() => cmd(props, "view.workbookViews.customViews")} />
              </Group>
              <Group label="Show">
                <LargeButton icon={<RulerRegular style={{ fontSize: 32 }} />} label="Ruler" onClick={() => cmd(props, "view.show.ruler")} />
                <LargeButton
                  icon={<GridRegular style={{ fontSize: 32 }} />}
                  label="Gridlines"
                  onClick={props.onToggleGridlines}
                  active={props.showGridlines}
                />
                <LargeButton
                  icon={<CodeRegular style={{ fontSize: 32 }} />}
                  label="Formula Bar"
                  onClick={props.onToggleFormulaBar}
                  active={props.showFormulaBar}
                />
              </Group>
              <Group label="Zoom">
                <LargeButton icon={<ZoomInRegular style={{ fontSize: 32 }} />} label="Zoom" onClick={props.onZoomIn} />
                <LargeButton icon={<FullScreenMaximizeRegular style={{ fontSize: 32 }} />} label="100%" onClick={() => cmd(props, "view.zoom.100")} />
                <LargeButton icon={<ZoomInRegular style={{ fontSize: 32 }} />} label="Selection" onClick={props.onZoomIn} />
              </Group>
              <Group label="Window">
                <LargeButton icon={<WindowNewRegular style={{ fontSize: 32 }} />} label="New" onClick={() => cmd(props, "view.window.newWindow")} />
                <LargeButton icon={<LayoutRowTwoRegular style={{ fontSize: 32 }} />} label="Arrange" onClick={() => cmd(props, "view.window.arrangeAll")} />
                <Menu positioning="below-start">
                  <MenuTrigger disableButtonEnhancement>
                    <span>
                      <LargeButton icon={<TableFreezeColumnRegular style={{ fontSize: 32 }} />} label="Freeze" onClick={props.onFreezePanes} />
                    </span>
                  </MenuTrigger>
                  <MenuPopover>
                    <MenuList>
                      <MenuItem onClick={props.onFreezePanes}>Freeze Panes</MenuItem>
                      <MenuItem onClick={props.onFreezePanes}>Freeze Top Row</MenuItem>
                      <MenuItem onClick={props.onFreezePanes}>Freeze First Column</MenuItem>
                      <MenuItem onClick={props.onFreezePanes}>Unfreeze Panes</MenuItem>
                    </MenuList>
                  </MenuPopover>
                </Menu>
                <LargeButton icon={<SplitVerticalRegular style={{ fontSize: 32 }} />} label="Split" onClick={() => cmd(props, "view.window.split")} />
                <LargeButton icon={<EyeOffRegular style={{ fontSize: 32 }} />} label="Hide" onClick={() => cmd(props, "view.window.hide")} />
                <LargeButton icon={<EyeRegular style={{ fontSize: 32 }} />} label="Unhide" onClick={() => cmd(props, "view.window.unhide")} />
                <LargeButton icon={<SplitVerticalRegular style={{ fontSize: 32 }} />} label="Side by Side" onClick={() => cmd(props, "view.window.sideBySide")} />
                <LargeButton icon={<ArrowSyncRegular style={{ fontSize: 32 }} />} label="Sync" onClick={() => cmd(props, "view.window.syncScroll")} />
                <LargeButton icon={<ArrowResetRegular style={{ fontSize: 32 }} />} label="Reset" onClick={() => cmd(props, "view.window.resetPosition")} />
                <LargeButton icon={<WindowMultipleRegular style={{ fontSize: 32 }} />} label="Switch" onClick={() => cmd(props, "view.window.switchWindows")} />
              </Group>
              <Group label="Macros">
                <LargeButton icon={<CodeRegular style={{ fontSize: 32 }} />} label="Macros" onClick={() => cmd(props, "view.macros.macros")} />
              </Group>
              <Group label="Theme">
                <LargeButton
                  icon={<DocumentRegular style={{ fontSize: 32 }} />}
                  label={props.isDarkMode ? "Dark" : "Light"}
                  onClick={props.onToggleDarkMode}
                  active={props.isDarkMode}
                />
              </Group>
            </>
          )}
        </div>
      </div>}
    </div>
  );
}

export default RibbonMenu;