import {
  IconHome, IconListCheck, IconMessageDots, IconMail, IconCalendarEvent,
  IconCalendar, IconEdit, IconBuilding, IconAddressBook, IconNotes,
  IconFileText, IconLanguage, IconFileDescription, IconTable, IconChartBar,
  IconBook, IconMessageCheck, IconBug,
} from "@tabler/icons-react";

const icons: Record<string, typeof IconHome> = {
  "/": IconHome, "/todo": IconListCheck, "/qa": IconMessageDots,
  "/email": IconMail, "/schedule": IconCalendarEvent, "/calendar": IconCalendar,
  "/content": IconEdit, "/clients": IconBuilding, "/members": IconAddressBook,
  "/template": IconNotes, "/document": IconFileText, "/translate": IconLanguage,
  "/summary": IconFileDescription, "/data": IconTable, "/insight": IconChartBar,
  "/glossary": IconBook, "/feedback": IconMessageCheck, "/issues": IconBug,
};

export default function WorkspaceIcon({ route }: { route: string }) {
  const Icon = icons[route] ?? IconNotes;
  return <Icon size={18} stroke={1.7} aria-hidden="true" />;
}
