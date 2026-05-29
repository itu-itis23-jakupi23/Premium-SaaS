import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';
import { LANGUAGES, getLanguageOption, setLanguagePreference, type LangCode } from '@/i18n';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const current = getLanguageOption(i18n.resolvedLanguage ?? i18n.language);

  const handleChange = (code: LangCode) => {
    void setLanguagePreference(code);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-9 gap-2 px-2.5 text-muted-foreground hover:text-foreground font-normal"
          aria-label={t("layout.selectLanguage")}
        >
          <Globe aria-hidden="true" className="w-4 h-4 flex-shrink-0" />
          <span aria-hidden="true" className="text-sm">{current.flag}</span>
          <span aria-hidden="true" className="text-xs font-medium hidden sm:inline">{current.code.toUpperCase()}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44 max-h-80 overflow-y-auto">
        {LANGUAGES.map(lang => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => handleChange(lang.code as LangCode)}
            className={`flex items-center gap-3 cursor-pointer ${lang.code === current.code ? 'bg-primary/10 text-primary font-medium' : ''}`}
          >
            <span aria-hidden="true" className="text-base leading-none">{lang.flag}</span>
            <span className="text-sm">{lang.label}</span>
            {lang.code === current.code && (
              <span aria-hidden="true" className="ml-auto w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
