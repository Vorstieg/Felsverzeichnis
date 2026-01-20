<script>
  import { _ } from 'svelte-i18n';
</script>

<svelte:head>
  <title>{$_('page.about.title')}</title>
</svelte:head>

<div class="prose prose-lg max-w-none mt-25 sm:mt-30 sm:px-17 px-7 overflow-scroll h-screen pb-65 text-slate-700">

  <p>
    {$_('page.about.intro')}
  </p>

  <p>
    {$_('page.about.github_text')}
    <a href="https://github.com/crag-review/crag-review-svelte" target="_blank" rel="noopener noreferrer">GitHub</a>
  </p>

  <p>
    {$_('page.about.mobility_text')}
    <br>
    <a href="https://www.alpenverein.at/portal/natur-umwelt/sanfte_mobilitaet/Mobilitaetsguide-Sportklettern.php" target="_blank" rel="noopener noreferrer">
      {$_('page.about.mobility_link_text')}
    </a>
  </p>

  <hr class="my-8 border-gray-200">

  <h2>{$_('page.about.imprint_title')}</h2>

  <div class="grid grid-cols-1 md:grid-cols-2 gap-8 not-prose">
    <div>
      <h3 class="font-bold text-lg mb-2 text-slate-800">{$_('page.about.publisher')}</h3>
      <p class="text-slate-600 leading-relaxed">
        {@html $_('page.about.publisher_address')}
      </p>
    </div>

    <div>
      <h3 class="font-bold text-lg mb-2 text-slate-800">{$_('page.about.contact')}</h3>
      <p class="text-slate-600">
        {$_('page.about.email')} <a href="mailto:office@vorstieg.eu" class="text-blue-600 hover:underline">office@vorstieg.eu</a>
      </p>
    </div>
  </div>

  <div class="mt-8 not-prose">
    <p class="text-slate-600">
      {$_('page.about.project_by')} <a href="https://www.vorstieg.eu" target="_blank" rel="noopener noreferrer" class="font-bold text-slate-800 hover:text-blue-600 transition-colors">Vorstieg Software</a>
    </p>
  </div>

</div>