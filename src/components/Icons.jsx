const Icon = ({ children, size = 20, ...props }) => (
  <svg
    aria-hidden="true"
    fill="none"
    height={size}
    viewBox="0 0 24 24"
    width={size}
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="1.75"
    {...props}
  >
    {children}
  </svg>
)

export const FolderIcon = () => <Icon><path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H9l2 2h8.5A1.5 1.5 0 0 1 21 8.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5z" /></Icon>
export const DownloadIcon = () => <Icon><path d="M12 3v12m0 0 4-4m-4 4-4-4" /><path d="M4 19h16" /></Icon>
export const EditIcon = () => <Icon><path d="m4 20 4.5-1 10-10a2.12 2.12 0 0 0-3-3l-10 10z" /><path d="m14.5 7.5 3 3" /></Icon>
export const SplitIcon = () => <Icon><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M12 4v16" /></Icon>
export const PreviewIcon = () => <Icon><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6" /><circle cx="12" cy="12" r="2.5" /></Icon>
export const CheckIcon = ({ size }) => <Icon size={size}><path d="m7 12 3 3 7-7" /></Icon>
export const MenuIcon = () => <Icon><path d="M4 7h16M4 12h16M4 17h10" /></Icon>
export const HeadingIcon = () => <Icon><path d="M6 5v14M18 5v14M6 12h12" /></Icon>
export const BoldIcon = () => <Icon><path d="M7 4h5a4 4 0 0 1 0 8H7zM7 12h6a4 4 0 0 1 0 8H7z" /></Icon>
export const ItalicIcon = () => <Icon><path d="M10 5h6M8 19h6M14 5 10 19" /></Icon>
export const LinkIcon = () => <Icon><path d="m10 13.5 4-4" /><path d="M7.5 15.5 6 17a3.54 3.54 0 0 1-5-5l3-3a3.54 3.54 0 0 1 5 0" transform="translate(2)" /><path d="M14.5 8.5 16 7a3.54 3.54 0 0 1 5 5l-3 3a3.54 3.54 0 0 1-5 0" transform="translate(-2)" /></Icon>
export const ListIcon = () => <Icon><path d="M8 6h12M8 12h12M8 18h12" /><circle cx="4" cy="6" r=".7" fill="currentColor" stroke="none" /><circle cx="4" cy="12" r=".7" fill="currentColor" stroke="none" /><circle cx="4" cy="18" r=".7" fill="currentColor" stroke="none" /></Icon>
export const QuoteIcon = () => <Icon><path d="M7 17H4.5A1.5 1.5 0 0 1 3 15.5V12a5 5 0 0 1 5-5v3a2 2 0 0 0-2 2h1zM18 17h-2.5a1.5 1.5 0 0 1-1.5-1.5V12a5 5 0 0 1 5-5v3a2 2 0 0 0-2 2h1z" /></Icon>
export const CodeIcon = () => <Icon><path d="m8 9-4 3 4 3M16 9l4 3-4 3M14 5l-4 14" /></Icon>
export const HelpIcon = () => <Icon><circle cx="12" cy="12" r="9" /><path d="M9.8 9a2.3 2.3 0 1 1 3.4 2c-.8.45-1.2.9-1.2 2M12 17h.01" /></Icon>
export const CloseIcon = () => <Icon><path d="m6 6 12 12M18 6 6 18" /></Icon>
export const PlusIcon = () => <Icon><path d="M12 5v14M5 12h14" /></Icon>
export const FileIcon = () => <Icon><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v5h5" /></Icon>
export const SearchIcon = () => <Icon><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></Icon>
export const CommandIcon = () => <Icon><path d="M9 6V5a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3v14a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3z" /></Icon>
export const UndoIcon = () => <Icon><path d="m9 7-5 5 5 5" /><path d="M5 12h8a6 6 0 0 1 6 6" /></Icon>
export const RedoIcon = () => <Icon><path d="m15 7 5 5-5 5" /><path d="M19 12h-8a6 6 0 0 0-6 6" /></Icon>
export const ChevronDownIcon = () => <Icon><path d="m7 10 5 5 5-5" /></Icon>
export const PanelIcon = () => <Icon><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16" /></Icon>
export const MoreIcon = () => <Icon><circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" /></Icon>
export const WarningIcon = () => <Icon><path d="M12 4 3.5 19h17z" /><path d="M12 9v4M12 16h.01" /></Icon>
export const TrashIcon = () => <Icon><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5" /></Icon>
export const FocusIcon = () => <Icon><path d="M8 3H4v4M16 3h4v4M8 21H4v-4M16 21h4v-4" /></Icon>
export const OutlineIcon = () => <Icon><path d="M9 6h11M9 12h11M9 18h11" /><circle cx="4" cy="6" r="1" /><circle cx="4" cy="12" r="1" /><circle cx="4" cy="18" r="1" /></Icon>
export const LiveIcon = () => <Icon><path d="M4 7.5h16M4 12h10M4 16.5h7" /><path d="m17 14 3 3-3 3" /></Icon>
export const TableIcon = () => <Icon><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M3 14h18M9 4v16M15 4v16" /></Icon>
export const TaskIcon = () => <Icon><rect x="3" y="4" width="6" height="6" rx="1" /><path d="m4.5 7 1.5 1.5L8 6M12 7h9M4 15h5M12 15h9M4 19h5M12 19h9" /></Icon>
export const ImageIcon = () => <Icon><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8" cy="9" r="1.5" /><path d="m4 18 5-5 3 3 2-2 6 6" /></Icon>
export const FootnoteIcon = () => <Icon><path d="M5 5h8M9 5v12M5 17h8M16 8h4M18 6v4M16 14h4M16 18h4" /></Icon>
export const StrikeIcon = () => <Icon><path d="M7 7.5c.7-1.4 2.2-2.2 4.3-2.2 2.4 0 4 .9 4.7 2.7M8 16.5c.9 1.4 2.3 2.2 4.2 2.2 2.5 0 4.3-1.2 4.3-3.2 0-1.8-1.2-2.7-4.5-3.5M4 12h16" /></Icon>
export const RuleIcon = () => <Icon><path d="M4 12h16" /></Icon>
export const DiagramIcon = () => <Icon><rect x="3" y="4" width="6" height="5" rx="1" /><rect x="15" y="15" width="6" height="5" rx="1" /><path d="M9 6.5h4a4 4 0 0 1 4 4V15M15 17.5h-4a4 4 0 0 1-4-4V9" /></Icon>
