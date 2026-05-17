import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';
import { LANGUAGES, applyDir, type LangCode } from '@/i18n';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const current = LANGUAGES.find(l => l.code === i18n.language) ?? LANGUAGES[0];

  const handleChange = (code: LangCode) => {
    i18n.changeLanguage(code);
    applyDir(code);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-9 gap-2 px-2.5 text-muted-foreground hover:text-foreground font-normal"
        >
          <Globe className="w-4 h-4 flex-shrink-0" />
          <span className="text-sm">{current.flag}</span>
          <span className="text-xs font-medium hidden sm:inline">{current.code.toUpperCase()}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44 max-h-80 overflow-y-auto">
        {LANGUAGES.map(lang => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => handleChange(lang.code as LangCode)}
            className={`flex items-center gap-3 cursor-pointer ${lang.code === current.code ? 'bg-primary/10 text-primary font-medium' : ''}`}
          >
            <span className="text-base leading-none">{lang.flag}</span>
            <span className="text-sm">{lang.label}</span>
            {lang.code === current.code && (
              <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
