<script lang="ts">
	import { base } from '$app/paths';
	import Logo from '$lib/components/ui/Logo.svelte';
	import { felsstudioUrl } from '$lib/config.js';
	const studio = felsstudioUrl.replace(/\/$/, '');
	const bischof = 'europe/austria/salzburg/dachstein-gebirge/bischofsmuetze';
	const ofen = 'europe/austria/lower-austria/wienerwald/roter-ofen/Hauptsektor';
	const steps = [
		['gebiete', 'Gebiet ergänzen oder anlegen'],
		['zugang', 'Zustieg, Hütten & Öffis'],
		['sportklettern', '2D-Topos fürs Sportklettern'],
		['alpinklettern', 'Mehrseillängen'],
		['gpx', 'GPX bearbeiten'],
		['einreichen', 'Beitrag prüfen und einreichen']
	];
</script>

<svelte:head>
	<title>Mitmachen · Felsstudio-Anleitung | Felsverzeichnis</title>
	<meta
		name="description"
		content="Neue Gebiete anlegen, Zustieg und Anreise beschreiben, 2D-Topos und Mehrseillängen zeichnen und GPX-Wege bearbeiten: die Felsstudio-Anleitung."
	/>
</svelte:head>

{#snippet screenshot(file: string, alt: string, caption: string)}
	<figure>
		<a
			href="{base}/guides/felsstudio/{file}.png"
			target="_blank"
			rel="noreferrer"
			aria-label="{alt} – Screenshot in voller Größe öffnen"
		>
			<img
				src="{base}/guides/felsstudio/{file}.png"
				{alt}
				width="1440"
				height="1000"
				loading="lazy"
			/>
		</a>
		<figcaption>{caption} <span>Zum Vergrößern anklicken.</span></figcaption>
	</figure>
{/snippet}

<div
	class="guide text-ink pointer-events-auto fixed inset-0 z-[6000] overflow-y-auto bg-white"
	lang="de"
>
	<header>
		<a class="brand" href="{base}/map"><Logo class="h-5 w-5" /> Felsverzeichnis</a>
		<a class="back" href="{base}/map">Zur Karte <span aria-hidden="true">↗</span></a>
	</header>
	<main class="guide-content">
		<div class="intro">
			<h1>Mitmachen: Felsstudio-Anleitung</h1>
			<p class="lead">
				Hilf mit, Topos und Tourenbeschreibungen für immer kostenlos im Internet zugänglich zu
				machen. Mit Felsstudio legst du Gebiete an, ergänzt Anreise und Zustieg und zeichnest Topos
				direkt im Browser – ohne Programmierkenntnisse. Auch eine korrigierte Beschreibung oder eine
				fehlende Route hilft: Du musst kein vollständiges Gebiet oder Topo erstellen.
			</p>
			<p>
				Du brauchst zum Bearbeiten und Einreichen kein Konto. Dein Beitrag wird geprüft und nach der
				Freigabe im Felsverzeichnis veröffentlicht.
			</p>
			<div class="actions">
				<a class="studio-link" href="{studio}/crags/select" target="_blank" rel="noreferrer"
					>Gebiet suchen und ergänzen <span aria-hidden="true">↗</span></a
				>
				<span>Sportklettern am Roten Ofen · Alpinklettern an der Bischofsmütze</span>
			</div>
		</div>
		<nav class="steps" aria-label="Inhalt der Anleitung">
			<p>Was möchtest du beitragen?</p>
			<p class="chapter-hint">
				Wähle das Kapitel für deinen Beitrag. Du musst nicht alle Schritte durchgehen. Zum Schluss
				reichst du deine Änderungen über „Beitrag prüfen und einreichen“ ein.
			</p>
			<ul>
				{#each steps as [id, label]}
					<li><a href="#{id}">{label}</a></li>
				{/each}
			</ul>
		</nav>

		<section id="gebiete">
			<p class="eyebrow">01 · Gebiet ergänzen oder anlegen</p>
			<h2>Starte mit deinem Gebiet im Gebiets-Studio</h2>
			<p>
				Im <strong>Gebiets-Studio</strong> erfasst du den Namen, die Lage und die Beschreibung eines Gebiets.
				Dazu kommen Sektoren, Anreiseinformationen und Zustiegswege.
			</p>
			<h3>Ein vorhandenes Klettergebiet ergänzen</h3>
			<p>
				Öffne das <a href="{studio}/crags/select" target="_blank" rel="noreferrer">Gebiets-Studio</a
				>, suche nach dem Klettergebiet und öffne den vorhandenen Eintrag. Für eine Textkorrektur
				bearbeitest du im Reiter <strong>Gebietsdaten</strong> das Feld
				<strong>Beschreibung (DE)</strong>. Lass ID und Hierarchie unverändert. Danach kannst du
				deinen
				<a href="#einreichen">Beitrag prüfen und einreichen</a>.
			</p>
			<h3>Gebiete, Felsen und Sektoren: Was gehört wohin?</h3>
			<p>
				In dieser Anleitung meint „Klettergebiet“ den Ort, an dem du kletterst. Im Editor heißt die
				Eintragsart dafür <strong>Fels</strong> – auch wenn sie mehrere Felsen umfasst. Ein
				<strong>Übergeordnetes Gebiet</strong> fasst mehrere solcher Klettergebiete räumlich
				zusammen. Ein <strong>Sektor</strong> unterteilt ein Klettergebiet in einzelne Wandbereiche. Die
				Routen und ihre Topos ordnest du dem passenden Fels oder Sektor zu.
			</p>
			<p>
				Die Reihenfolge ist: <strong>Übergeordnetes Gebiet → Fels → Sektor</strong>. Zum Beispiel
				ist das <strong>Dachstein-Gebirge</strong> das übergeordnete Gebiet und die
				<strong>Bischofsmütze</strong> ein Fels darin. Beim <strong>Roten Ofen</strong> sind
				<strong>Hauptsektor</strong> und <strong>Südwestpfeiler</strong> zwei Sektoren desselben Felses.
			</p>
			<h3>Den neuen Eintrag erstellen</h3>
			<ol>
				<li>
					Öffne <a href="{studio}/crags/select" target="_blank" rel="noreferrer">Gebiets-Studio</a>
					und suche zuerst nach dem Gebiet. Öffne einen vorhandenen Eintrag zum Ergänzen. Fehlt das Gebiet,
					wähle <strong>Neuer Fels</strong>.
				</li>
				<li>
					Trage im Reiter <strong>Gebietsdaten</strong> den Namen im Feld <strong>Name</strong> ein.
					Für ein Klettergebiet wählst du unter <strong>Eintragsart</strong> den Wert
					<strong>Fels</strong>. Ein einzelner Sektor erhält
					<strong>Sektor</strong>; Länder, Regionen und übergeordnete Gebiete werden als
					<strong>Land</strong>, <strong>Region</strong> beziehungsweise
					<strong>Übergeordnetes Gebiet</strong> eingeordnet.
				</li>
				<li>
					Öffne <strong>Hierarchie bearbeiten</strong>. Wähle in
					<strong>Einordnung in die Hierarchie</strong>
					den übergeordneten Ordner oder trage den Pfad unter <strong>Übergeordneter Ordner</strong>
					ein. Bestätige mit <strong>Fertig</strong>. Die Bischofsmütze liegt beispielsweise unter
					<strong>europe → austria → salzburg → dachstein-gebirge</strong>. Die Vorschau
					<strong>Vollständiger Zielpfad</strong> zeigt den vollständigen Zielpfad.
				</li>
				<li>
					Prüfe die <strong>ID</strong>: Sie ist die Kennung im Pfad, etwa
					<strong>bischofsmuetze</strong>. Verwende für neue Einträge eine eindeutige Kennung. Bei
					einem bestehenden Gebiet musst du die ID für eine normale Textkorrektur nicht ändern.
				</li>
				<li>
					Ergänze unter <strong>Kletterarten</strong> die Kletterarten. Beschreibe das Gebiet in
					<strong>Beschreibung (DE)</strong>, bei Bedarf auch in <strong>Beschreibung (EN)</strong>:
					Charakter der Kletterei, Anreise, Zustieg und bekannte Besonderheiten. Bekannte Angaben zu
					Felsart, Absicherung und Ausrüstung kommen unter <strong>Felsart</strong>,
					<strong>Absicherung</strong>
					und <strong>Ausrüstung</strong>. Eigene Übersichtsbilder ergänzt du unter
					<strong>Bilder → + Hinzufügen</strong>.
				</li>
			</ol>
			{@render screenshot(
				'07-gebiet',
				'Bischofsmütze im Gebiets-Studio mit Gebietsdaten, Gebietsname, Art, Kletterarten und Beschreibungen',
				'Die Gebietsdaten der Bischofsmütze im Gebiets-Studio. Die Anleitung verwendet die deutschen Bezeichnungen der Oberfläche.'
			)}
			<h3>Lage auf der Karte festlegen</h3>
			<p>
				Wähle <strong>Lage bearbeiten</strong>. Mit <strong>Punkt</strong> setzt du eine einzelne
				Gebietsposition, mit <strong>Fläche</strong> eine flächige Begrenzung. Verschiebe die Karte
				an die gewünschte Stelle und nutze <strong>Zum Kartenmittelpunkt verschieben</strong>, um
				die Geometrie dorthin zu verschieben. Alternativ trägst du <strong>Längengrad</strong> und
				<strong>Breitengrad</strong> ein. Bei einer Fläche kannst du anschließend ihre Eckpunkte auf der
				Karte an den tatsächlichen Gebietsrand anpassen.
			</p>
			{@render screenshot(
				'08-geometrie',
				'Lage bearbeiten für die Bischofsmütze mit Punkt, Fläche und den Koordinatenfeldern',
				'Prüfe die Position unabhängig von der Ordnerzuordnung. Punkt und Fläche bestimmen, wie das Gebiet auf der Karte erscheint.'
			)}
			<h3>Sektoren anlegen</h3>
			<p>
				Für Sektoren öffnest du <strong>Untereinträge</strong> und klickst auf das Plus
				<strong>Untereintrag hinzufügen</strong>. Wähle den neuen Eintrag aus und ergänze seine
				Metadaten, die Art <strong>Sektor</strong> und seine Lage. Beim Roten Ofen gehören zum
				Beispiel der
				<strong>Hauptsektor</strong> und der <strong>Südwestpfeiler</strong> zum gemeinsamen Klettergebiet.
				Lege das spätere Topo bei dem Eintrag an, dessen Wandbereich es zeigt.
			</p>
		</section>

		<section id="zugang">
			<p class="eyebrow">02 · Anreise und Zustieg ergänzen</p>
			<h2>Wie kommt man hin? Zustieg, Hütten und öffentliche Verkehrsmittel</h2>
			<p>
				Öffne das Klettergebiet im <strong>Gebiets-Studio</strong> und ergänze die Orientierung vor
				Ort. Beschreibe in
				<strong>Beschreibung (DE)</strong> den Ausgangspunkt, den Zustieg und den Abstieg sowie bekannte
				Zugangsregelungen, Sperren oder saisonale Einschränkungen. Ergänze bekannte Gehzeiten und markante
				Abzweigungen, damit der Weg zum richtigen Wandbereich nachvollziehbar ist.
			</p>
			<ul>
				<li>
					<strong>Parkplätze:</strong> Setze mit <strong>Parkplatz</strong> den passenden Ausgangspunkt
					auf die Karte und beschreibe bekannte Parkmöglichkeiten und Einschränkungen.
				</li>
				<li>
					<strong>Hütten:</strong> Trage mit <strong>Hütte</strong> relevante Hütten ein. Beschreibe ihre
					Rolle als Ausgangspunkt oder Stützpunkt. An der Bischofsmütze ist etwa die Hofpürgelhütte ein
					Ausgangspunkt für den Zustieg.
				</li>
				<li>
					<strong>Öffentliche Verkehrsmittel:</strong> Setze mit <strong>Haltestelle</strong>
					die geeignete Bus- oder Bahnhaltestelle. Ergänze den Haltestellennamen, die Verbindung zum Zustieg
					und, soweit bekannt, Hinweise zum saisonalen Betrieb. Für Fahrpläne verlinkst du am besten die
					zuständigen Verkehrsunternehmen.
				</li>
			</ul>
			<p>
				Im Reiter <strong>Verzeichnis</strong> kannst du die gesetzten Punkte benennen und
				bearbeiten. Zustiegs- und Abstiegswege zeichnest oder importierst du über
				<strong>Wege</strong>. Wie du ihre Punkte korrigierst und GPX-Aufzeichnungen aufräumst,
				erklärt das
				<a href="#gpx">GPX-Kapitel</a>.
			</p>
			{@render screenshot(
				'10-anreise',
				'Bischofsmütze im Gebiets-Studio mit dem Verzeichnis für Haltestellen, Parkplätze, Hütten und Zustiegswege',
				'Im Verzeichnis benennst und bearbeitest du Haltestellen, Parkplätze, Hütten und Zustiegswege. Die Werkzeuge oben setzen neue Anreisepunkte auf die Karte.'
			)}
		</section>

		<section id="sportklettern">
			<p class="eyebrow">03 · 2D-Topos fürs Sportklettern</p>
			<h2>Vom Wandfoto zur Sportkletterroute</h2>
			<p>
				Für ein 2D-Topo trägst du Routennamen und Angaben bei, die du aus eigener Erfahrung
				beitragen kannst. Als Hintergrund kannst du ein eigenes Wandfoto oder eine Skizze verwenden.
				Verwende eigene Bilder und Texte oder solche, für deren Veröffentlichung du die Erlaubnis
				hast. Ein Hintergrundbild ist optional: Mit <strong>Umriss</strong> kannst du Felskonturen selbst
				zeichnen.
			</p>
			<h3>Das 2D Studio für dein Klettergebiet oder deinen Sektor öffnen</h3>
			<p>Wähle den passenden Einstieg:</p>
			<ul>
				<li>
					<strong>Ein neues Topo anlegen:</strong> Wechsle im Gebietsentwurf über das
					<strong>Dreipunktmenü oben rechts</strong> zum <strong>2D Studio</strong>. Der Entwurf
					bleibt beim Wechsel erhalten. Prüfe, ob das Topo dem richtigen Klettergebiet oder Sektor
					zugeordnet ist.
				</li>
				<li>
					<strong>Ein bestehendes Topo bearbeiten:</strong> Öffne die
					<a href="{studio}/topos/2d/select" target="_blank" rel="noreferrer">2D-Studio-Auswahl</a>.
					Suche für das Beispiel nach <strong>Roter Ofen → Hauptsektor</strong>.
				</li>
			</ul>
			<p>
				Im geöffneten Topo ergänzt du im Reiter <strong>Info</strong> Autor, Beschreibung und
				Wandausrichtung. Wenn du ein Hintergrundbild verwenden möchtest, lädst du es unter
				<strong>Hintergrundbild laden → Datei auswählen</strong> hoch.
			</p>
			<div class="example-links">
				<a href="{studio}/topos/2d/editor/{ofen}" target="_blank" rel="noreferrer"
					>Roter Ofen im 2D Studio ↗</a
				>
				<a href="{studio}/topos/2d/editor/{bischof}" target="_blank" rel="noreferrer"
					>Bischofsmütze im 2D Studio ↗</a
				>
			</div>
			<h3>Routen zeichnen und beschreiben</h3>
			<p>
				Am <strong>Roten Ofen, Hauptsektor</strong> siehst du, wie einzelne Sportkletterrouten
				nebeneinander erfasst werden. Im Screenshot ist unter anderem <strong>Zwergeneck</strong> mit
				seiner Schwierigkeit zu sehen.
			</p>
			<ol>
				<li>
					Wähle oben das Werkzeug <strong>Route</strong>. Klicke vom Einstieg aus nacheinander die
					Punkte des Routenverlaufs bis zum Umlenker an. Setze zusätzliche Punkte dort, wo sich die
					Richtung ändert.
				</li>
				<li>
					Schließe die Linie mit <strong>Abschließen</strong> (Häkchen in der Werkzeugleiste) ab. Für
					die nächste Route beginnst du einen neuen Verlauf.
				</li>
				<li>
					Öffne rechts <strong>Routen</strong> und wähle die Route aus. Ergänze
					<strong>Name</strong>, die Art <strong>Sportklettern</strong>, den <strong>Grad</strong>
					mit passender Bewertungsskala sowie bekannte Angaben zu <strong>Länge</strong> und
					<strong>Absicherung</strong>.
				</li>
				<li>
					Ergänze in der Beschreibung Besonderheiten zur Kletterei oder Absicherung. Mit <strong
						>Auswählen</strong
					> kannst du bestehende Linien markieren und ihre Punkte korrigieren. Fehler lassen sich über
					den Rückgängig-Pfeil oben beheben.
				</li>
			</ol>
			{@render screenshot(
				'03-sportklettern',
				'Roter Ofen, Hauptsektor, im Felsstudio mit Sportkletterrouten und den Eingabefeldern für Zwergeneck',
				'Sportklettern am Roten Ofen: Jede Route hat einen eigenen Verlauf und eigene Angaben zu Schwierigkeit, Länge und Absicherung.'
			)}
			<aside>
				Prüfe vorbelegte Werte und ergänze nur Angaben, die du kennst. Eine angezeigte 0 bei der
				Länge ist keine gemessene Routenlänge. Aus einer gezeichneten Linie allein lässt sich die
				reale Länge nicht zuverlässig ableiten.
			</aside>
			<p>
				Mit <strong>Fixpunkte</strong> ergänzt du bekannte Haken und Umlenker. Im gleichnamigen
				Reiter bearbeitest du die gesetzten Symbole. Mit <strong>Text</strong> und
				<strong>Umriss</strong> ergänzt du Orientierungspunkte und Felskonturen.
			</p>
		</section>

		<section id="alpinklettern">
			<p class="eyebrow">04 · Mehrseillängen an der Bischofsmütze</p>
			<h2>Eine Tour, mehrere Seillängen</h2>
			<p>
				Der <strong>Normalweg an der Bischofsmütze</strong> zeigt den Aufbau einer alpinen
				Klettertour: eine gemeinsame Route mit mehreren einzeln bearbeitbaren Seillängen. Für diese
				Art von Topo verwendest du <strong>Mehrseillänge</strong>.
			</p>
			<p>
				Öffne zuerst das <strong>2D Studio</strong> für dein Klettergebiet oder deinen Sektor. Aus
				einem Gebietsentwurf wechselst du über das <strong>Dreipunktmenü oben rechts</strong>
				dorthin. Zum Beispiel kannst du die
				<a href="{studio}/topos/2d/editor/{bischof}" target="_blank" rel="noreferrer"
					>Bischofsmütze im 2D Studio</a
				> öffnen. Prüfe vor dem Zeichnen, ob das richtige Klettergebiet oder der richtige Sektor ausgewählt
				ist.
			</p>
			<ol>
				<li>
					Wähle das Werkzeug <strong>Mehrseillänge</strong> und zeichne die erste Seillänge vom
					Einstieg bis zum ersten Stand. Schließe sie mit <strong>Abschließen</strong> ab.
				</li>
				<li>
					Zeichne anschließend die nächste Seillänge vom vorherigen Stand bis zum nächsten Stand und
					bestätige wieder mit <strong>Abschließen</strong>. Der Editor setzt die Tour mit einer
					weiteren Seillänge fort. Wechsle nach der letzten Länge zu <strong>Auswählen</strong>.
				</li>
				<li>
					Im Reiter <strong>Routen</strong> findest du die Tour mit der Art
					<strong>Mehrseillänge</strong>. Gib den Tourennamen ein und ergänze für
					<em>jede Seillänge</em> Schwierigkeit, Länge und bekannte Angaben zur Absicherung.
				</li>
				<li>
					Eine bestehende Tour ergänzt du unter <strong>Seillängen → + Hinzufügen</strong>. Über das
					Stiftsymbol an einer Seillänge kannst du deren Verlauf bearbeiten. Unter
					<strong>Varianten</strong> lassen sich abweichende Linien ergänzen.
				</li>
			</ol>
			{@render screenshot(
				'04-mehrseillaengen',
				'Normalweg an der Bischofsmütze mit der Liste seiner Seillängen und Eingabefeldern für Grad und Länge',
				'Bischofsmütze: Der Normalweg wird als zusammenhängende Tour mit acht Seillängen bearbeitet. Schwierigkeit und Länge werden je Seillänge eingetragen.'
			)}
			<p>
				Beschreibe auch Zustieg, Einstieg, Abstieg, Rückzugsmöglichkeiten und benötigtes Material.
				Gebietsangaben und Wege ergänzt du im Gebiets-Studio. Verwende für alpine Klettertouren mit
				Seillängen die Art <strong>Mehrseillänge</strong>; die separate Art
				<strong>Hochtour</strong> ist für einen anderen Tourentyp gedacht.
			</p>
			<h3>Standplätze, Haken und Orientierung ergänzen</h3>
			<p>
				Mit <strong>Fixpunkte</strong> wählst du das passende Symbol und setzt es an die richtige Stelle
				im Topo – etwa für Bohrhaken, Standplätze oder Umlenker. Im gleichnamigen Reiter rechts kannst
				du die gesetzten Punkte bearbeiten. Verwende nur Symbole für Sicherungspunkte, die du tatsächlich
				kennst.
			</p>
			<p>
				Mit <strong>Umriss</strong> zeichnest du Felskonturen, mit <strong>Symbol</strong> weitere
				Geländemerkmale und mit <strong>Text</strong> Hinweise wie Gipfel, Scharte oder markante Bänder.
				Beschrifte sparsam, damit Routenlinien und Seillängen lesbar bleiben.
			</p>
			{@render screenshot(
				'05-fixpunkte',
				'Fixpunkte des Bischofsmütze-Topos im Felsstudio mit Symbolen für die Sicherungspunkte',
				'Fixpunkte und Geländeformen machen das Bischofsmütze-Topo nachvollziehbar. Prüfe besonders, ob Standplätze und Seillängenenden zusammenpassen.'
			)}
		</section>

		<section id="gpx">
			<p class="eyebrow">05 · GPX und Wege bearbeiten</p>
			<h2>Zustieg, Tourenweg und Abstieg auf der Karte</h2>
			<p>
				Eine Linie im 2D-Topo beschreibt den Verlauf an der Wand. Ein GPX-Weg enthält dagegen
				geografische Koordinaten für die Karte. Beides bearbeitest du getrennt: Topolinien im <strong
					>2D Studio</strong
				>, GPX-Wege im <strong>Gebiets-Studio</strong>. Als Beispiel dient hier der vorhandene
				<strong>Zustieg von der Hofpürgelhütte zur Bischofsmütze</strong>.
			</p>
			<h3>Einen Weg importieren, zeichnen oder öffnen</h3>
			<p>
				Öffne das passende Gebiet im <strong>Gebiets-Studio</strong> oder wechsle aus deinem Topoentwurf
				über das Dreipunktmenü dorthin. Wähle dann den passenden Einstieg:
			</p>
			<ul>
				<li>
					<strong>Eine GPX-Datei importieren:</strong> Wähle oben <strong>Wege</strong>. Öffne links
					<strong>Wegwerkzeuge → GPX importieren</strong>
					und wähle deine GPX-Datei. Enthält sie mehrere getrennte Abschnitte, wählst du den gewünschten
					Abschnitt und bestätigst mit <strong>Abschnitt importieren</strong>. Getrennte Abschnitte
					werden nicht automatisch miteinander verbunden.
				</li>
				<li>
					<strong>Einen neuen Weg zeichnen:</strong> Wähle oben <strong>Wege</strong> und nutze
					<strong>Track verlängern</strong>. <strong>Wegen folgen</strong> sucht zwischen
					angeklickten Zielen einen Verlauf auf Fußwegen; <strong>Gerade Linien</strong>
					verbindet deine Punkte direkt. Prüfe bei beiden Varianten den Verlauf auf der Karte.
				</li>
				<li>
					<strong>Einen vorhandenen Weg bearbeiten:</strong> Öffne im Reiter
					<strong>Verzeichnis</strong> beim gewünschten Zustieg das Stiftsymbol
					<strong>Zustiegsweg bearbeiten</strong>. Routenpfade öffnest du dort mit
					<strong>Weg bearbeiten</strong>.
				</li>
			</ul>
			<p>
				Für alle drei Einstiege gilt: Mit <strong>Gesamten Weg anzeigen</strong> passt du den Kartenausschnitt
				an. A markiert den Anfang, B das Ende des Wegs. Anschließend kannst du den Verlauf mit den folgenden
				Werkzeugen korrigieren.
			</p>
			{@render screenshot(
				'09-gpx-bearbeiten',
				'GPX-Zustieg von der Hofpürgelhütte zur Bischofsmütze im Gebiets-Studio mit Wegwerkzeugen und Punktbearbeitung',
				'Der aus den vorhandenen Wegdaten importierte Zustieg im echten GPX-Editor. Die Bearbeitung bleibt bis zum Abschließen ein Arbeitsstand.'
			)}
			<h3>Punkte korrigieren und den Track aufräumen</h3>
			<ul>
				<li>
					<strong>Punkte bearbeiten:</strong> Klicke einen Punkt an und ziehe ihn an die richtige
					Stelle. Ziehe einen Mittelpunkt zwischen zwei Punkten, um einen weiteren Punkt einzufügen.
					Über <strong>Ausgewählte Punkte löschen</strong> entfernst du Fehlpunkte; mindestens zwei Punkte
					müssen erhalten bleiben.
				</li>
				<li>
					<strong>Mehrere Punkte auswählen:</strong> Strg/Cmd ergänzt Punkte zur Auswahl, Umschalt
					wählt einen Streckenabschnitt. Alternativ verwendest du <strong>Punktauswahl</strong> mit Mehrfach-,
					Strecken- oder Rechteckauswahl.
				</li>
				<li>
					<strong>Kürzen:</strong> Wähle einen Grenzpunkt und nutze
					<strong>Vor Punkt kürzen</strong>
					oder <strong>Nach Punkt kürzen</strong>. Prüfe die Vorschau und bestätige die Kürzung mit
					dem Häkchen in der Werkzeugleiste.
				</li>
				<li>
					<strong>Wegwerkzeuge:</strong> Mit <strong>Gesamten Weg umkehren</strong> tauschst du
					Anfang und Ende. <strong>Weg teilen</strong> zerlegt den Track an der gewählten Stelle;
					prüfe und bestätige die Vorschau. Zum Verbinden vorhandener Tracks wählst du
					<strong>Tracks verbinden</strong>, klickst den zweiten Track an und prüfst die geplante
					Verbindung, bevor du sie übernimmst.
				</li>
				<li>
					<strong>GPS-Drift bereinigen:</strong> Unter <strong>Wegwerkzeuge → Bereinigen</strong>
					<strong>GPS-Drift bereinigen · gesamter Weg</strong> reduziert dichte Punktgruppen, etwa durch
					eine Pause bei laufender Aufzeichnung. Prüfe danach, ob Kurven und Abzweigungen noch stimmen.
					Rückgängig und Wiederholen helfen beim Vergleichen.
				</li>
			</ul>
			<h3>Was macht „Vereinfachen“?</h3>
			<p>
				Eine GPX-Aufzeichnung kann auf einem fast geraden Weg sehr viele Punkte enthalten.
				<strong>Vereinfachen</strong> entfernt Zwischenpunkte und beschreibt den Verlauf mit weniger
				Punkten. Anfang und Ende des Wegs bleiben erhalten. Die
				<strong>Vereinfachungstoleranz (m)</strong> steuert, wie stark die Linie vereinfacht wird: Eine
				kleine Toleranz erhält mehr Details; eine größere entfernt mehr Punkte und kann Kurven und Kehren
				stärker abkürzen.
			</p>
			<ol>
				<li>
					Öffne <strong>Wegwerkzeuge → Bereinigen</strong> und trage die gewünschte
					<strong>Vereinfachungstoleranz (m)</strong> ein.
				</li>
				<li>
					Wähle <strong>Gesamten Weg vereinfachen</strong> für den vollständigen Track oder markiere
					zuerst einen Abschnitt und verwende <strong>Ausgewählte Bereiche vereinfachen</strong>.
					Bei der zweiten Variante bleiben die Punkte außerhalb der ausgewählten Bereiche erhalten.
				</li>
				<li>
					Prüfe die neue Linie und die angezeigte Punktzahl. Mit <strong>Rückgängig</strong>
					stellst du den vorherigen Verlauf wieder her und kannst eine kleinere Toleranz ausprobieren.
					Übernimm das Ergebnis anschließend mit <strong>Bearbeitung abschließen</strong>.
				</li>
			</ol>
			<aside>
				<strong>Beispiel Bischofsmütze:</strong> Der hier verwendete Zustieg von der Hofpürgelhütte hat
				166 Punkte. Die Vereinfachung des gesamten Wegs ergibt mit 5 m Toleranz 65 Punkte, mit 10 m 33
				Punkte und mit 20 m 15 Punkte. Das sind Ergebnisse dieses Beispieltracks; bei anderen Aufzeichnungen
				fällt die Reduktion anders aus.
			</aside>
			<h3>Übernehmen und der Tour zuordnen</h3>
			<p>
				Bestätige offene Vorschauen und klicke auf <strong>Bearbeitung abschließen</strong> in der
				Werkzeugleiste. Erst damit übernimmst du die Wegbearbeitung in deinen Entwurf. Mit
				<strong>Änderungen verwerfen</strong>
				verwirfst du die laufende Bearbeitung. Benenne den übernommenen Zustieg im
				<strong>Verzeichnis</strong>, damit sein Ausgangspunkt erkennbar ist.
			</p>
			<p>
				Für einen Weg, der zu einer bestimmten Tour gehört, öffnest du unter <strong
					>Untereinträge</strong
				>
				die Routendetails. Unter <strong>Wege → Weg hinzufügen</strong> legst du einen Routenpfad an
				und kannst darin eine GPX-Datei importieren. Einen bestehenden Routenpfad verknüpfst du über
				<strong>Vorhandenen Weg zuordnen…</strong>; einen vorhandenen Gebietszustieg übernimmst du
				mit
				<strong>Zustiegsweg kopieren…</strong>. Wähle die passende Rolle: <strong>Zustieg</strong>
				für den Zustieg, <strong>Hauptverlauf</strong> für den Hauptverlauf,
				<strong>Abstieg</strong>
				für den Abstieg oder <strong>Variante</strong> für eine Variante.
			</p>
			<aside>
				„Bearbeitung abschließen“ übernimmt den Weg in deinen lokalen Entwurf. Zum Einreichen aller
				Änderungen klickst du anschließend auf <strong>Zur Prüfung einreichen</strong>. Kontrolliere
				vorher Richtung, Start- und Endpunkt sowie die Zuordnung von Zustieg und Abstieg.
			</aside>
		</section>

		<section id="einreichen">
			<p class="eyebrow">06 · Für jeden Beitrag</p>
			<h2>Beitrag prüfen und einreichen</h2>
			<p>
				Ob Textkorrektur, neue Route oder vollständiges Topo: Prüfe die Punkte, die für deinen
				Beitrag zutreffen.
			</p>
			<ul class="checklist">
				<li>
					Sind Gebiet und Sektor richtig zugeordnet, ihre Lage geprüft und die Routennamen
					vollständig?
				</li>
				<li>
					Ist die GPX-Bearbeitung abgeschlossen und sind die Wege mit der richtigen Rolle
					zugeordnet?
				</li>
				<li>Stimmen Verlauf, Bewertungsskala, Schwierigkeiten und bekannte Längen?</li>
				<li>Sind bei Mehrseillängen die Reihenfolge und die Standplätze nachvollziehbar?</li>
				<li>Sind Zustieg, Abstieg, Ausrüstung und wichtige Besonderheiten beschrieben?</li>
				<li>Hast du die Rechte an den verwendeten Bildern und Texten und den Autor angegeben?</li>
			</ul>
			<h3>Speichern, abschließen und einreichen: Was ist der Unterschied?</h3>
			<ul>
				<li>
					<strong>Automatische Speicherung:</strong> Dein Arbeitsstand bleibt lokal im Browser.
				</li>
				<li>
					<strong>Bearbeitung abschließen:</strong> Bei der Wegbearbeitung übernimmst du damit den bearbeiteten
					Weg in deinen Entwurf.
				</li>
				<li>
					<strong>Zur Prüfung einreichen:</strong> Erst damit übermittelst du deinen Beitrag zur Prüfung
					und anschließenden Veröffentlichung nach Freigabe.
				</li>
			</ul>
			<p>
				Klicke oben rechts auf <strong>Zur Prüfung einreichen</strong>. Warte auf die Bestätigung
				<strong>Zur Prüfung eingereicht.</strong> Damit ist dein Beitrag eingereicht. Er wird anschließend
				geprüft und nach der Freigabe im Felsverzeichnis veröffentlicht.
			</p>

			{@render screenshot(
				'06-einreichen',
				'Roter Ofen im Felsstudio mit Zur Prüfung einreichen und geöffnetem Dreipunktmenü zum Wechseln der Entwurfseditoren',
				'Oben rechts reichst du dein Topo ein. Im Dreipunktmenü wechselst du zwischen 2D Studio und Gebiets-Studio, ohne einen neuen Entwurf zu beginnen.'
			)}
		</section>

		<footer class="invitation">
			<p class="eyebrow">Gemeinsam wird die Sammlung besser</p>
			<h2>Dein erstes Topo? Ich freue mich darauf.</h2>
			<p>
				Auch Ergänzungen und Korrekturen helfen. Sag mir gerne, was fehlt, wo du hängen bleibst oder
				was wir verständlicher machen können.
			</p>
			<p><strong>Für jedes eingereichte Topo zahle ich gerne ein Bier!</strong></p>
			<div class="actions">
				<a class="studio-link" href="{studio}/crags/select" target="_blank" rel="noreferrer"
					>Jetzt ein Gebiet suchen und ergänzen ↗</a
				>
				<a href="mailto:office@vorstieg.eu?subject=Feedback%20zu%20Felsstudio">Feedback schicken</a>
			</div>
		</footer>
	</main>
</div>

<style>
	.guide {
		scroll-behavior: smooth;
		line-height: 1.7;
	}
	header,
	.guide-content {
		width: min(100% - 3rem, 56rem);
		margin-inline: auto;
	}
	header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
		padding-block: 1rem;
		border-bottom: 1px solid #e2e8f0;
	}
	a {
		text-decoration: underline;
		text-underline-offset: 3px;
	}
	a:hover {
		color: #475569;
	}
	a:focus-visible {
		outline: 2px solid #475569;
		outline-offset: 4px;
	}
	.brand {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-weight: 650;
		text-decoration: none;
	}
	.back {
		font-size: 0.875rem;
		white-space: nowrap;
	}
	.guide-content {
		padding-bottom: 2rem;
	}
	.intro {
		padding-top: 2rem;
	}
	h1 {
		font-size: clamp(1.65rem, 4vw, 2.1rem);
		line-height: 1.3;
		font-weight: 700;
		margin-bottom: 1rem;
	}
	.intro > p,
	section p,
	.invitation p {
		margin-block: 0.75rem;
	}
	.actions,
	.example-links {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.5rem 1.25rem;
		margin-block: 1rem;
	}
	.actions > span {
		font-size: 0.875rem;
		color: #64748b;
	}
	.studio-link {
		font-weight: 650;
	}
	.steps {
		margin-top: 1.5rem;
		padding-block: 1rem;
		border-block: 1px solid #e2e8f0;
	}
	.steps p {
		font-weight: 650;
	}
	.steps ul {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.25rem 2rem;
		margin-block: 0.5rem 0;
		font-size: 0.9375rem;
	}
	.steps .chapter-hint {
		font-weight: 400;
		margin-block: 0.5rem;
	}
	.steps li {
		margin: 0;
	}
	section {
		padding-top: 2rem;
		scroll-margin-top: 1rem;
	}
	.eyebrow {
		font-size: 0.875rem;
		color: #64748b;
	}
	h2 {
		font-size: 1.5rem;
		line-height: 1.35;
		font-weight: 650;
		margin-bottom: 0.75rem;
	}
	h3 {
		font-size: 1.125rem;
		font-weight: 650;
		margin-block: 1.5rem 0.5rem;
	}
	ul,
	ol {
		padding-left: 1.5rem;
		margin-block: 1rem;
	}
	ol {
		list-style: decimal;
	}
	ul {
		list-style: disc;
	}
	li {
		padding-left: 0.125rem;
		margin-bottom: 0.5rem;
	}
	aside {
		border-left: 2px solid #cbd5e1;
		padding: 0.5rem 1rem;
		margin-top: 1rem;
		font-size: 0.9375rem;
		color: #475569;
	}
	figure {
		margin-block: 1.5rem 0;
	}
	figure a {
		display: block;
		border: 1px solid #e2e8f0;
	}
	figure img {
		display: block;
		width: 100%;
		height: auto;
	}
	figcaption,
	.source-note {
		font-size: 0.8125rem;
		line-height: 1.6;
		color: #64748b;
	}
	figcaption {
		margin-top: 0.5rem;
	}
	.invitation {
		margin-top: 2rem;
		padding-top: 1.5rem;
		border-top: 1px solid #e2e8f0;
	}
	.source-note {
		margin-top: 1.5rem;
	}
	@media (max-width: 600px) {
		header,
		.guide-content {
			width: calc(100% - 2rem);
		}
		.steps ul {
			grid-template-columns: 1fr;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.guide {
			scroll-behavior: auto;
		}
	}
</style>
