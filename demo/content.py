"""Nineteenth-century notes for Plugin Playground, the test vault.

They give the vault's reader a second interest beside Tolkien:
nineteenth-century literature, science and art. Facts come from Wikipedia;
every summary is written for the vault. Images are public-domain lead images from
Wikimedia Commons (see images.py), one per note at most.

Dates are offsets in days before the day build.py runs, so due dates,
"this week" sections and Rediscover stay meaningful. `age` is how long ago the note was last edited.
"""

# ------------------------------------------------------------------ people
# (name, wikipedia title, field, born, died, nationality, known_for, age, body)
PEOPLE = [
    ("Mary Shelley", "Mary Shelley", "Writer", 1797, 1851, "British", ["Frankenstein"], 300,
     "Wrote [[Frankenstein]] at nineteen, after the ghost-story contest with Lord Byron and Percy Shelley at the [[Villa Diodati]] in the wet summer of 1816. "
     "Daughter of Mary Wollstonecraft and William Godwin. Her 1831 introduction to the novel tells the story of its first night; see [[Shelley's 1831 introduction]]. "
     "Her later novel The Last Man (1826) imagines the end of humanity by plague."),
    ("Jane Austen", "Jane Austen", "Writer", 1775, 1817, "British", ["Pride and Prejudice", "Emma", "Persuasion", "Sense and Sensibility"], 340,
     "Published four novels in her lifetime, all anonymously, the first as \"By a Lady\". "
     "[[Persuasion]] and Northanger Abbey appeared after her death in 1817. "
     "The Cobb at [[Lyme Regis]] is where Louisa Musgrove falls in Persuasion; Austen visited the town in 1803 and 1804."),
    ("Charlotte Brontë", "Charlotte Brontë", "Writer", 1816, 1855, "British", ["Jane Eyre"], 360,
     "The eldest of the three Brontë sisters who survived into adulthood, raised at the parsonage in [[Haworth]]. "
     "[[Jane Eyre]] came out in 1847 under the name Currer Bell and sold at once. "
     "Her friend Elizabeth Gaskell wrote her biography two years after her death."),
    ("Emily Brontë", "Emily Brontë", "Writer", 1818, 1848, "British", ["Wuthering Heights"], 380,
     "Published [[Wuthering Heights]] in 1847 as Ellis Bell, a few months after her sister's [[Jane Eyre]]. "
     "It is her only novel; she died the next year, aged thirty. The moors above [[Haworth]] are its landscape."),
    ("Charles Dickens", "Charles Dickens", "Writer", 1812, 1870, "British", ["Great Expectations", "A Tale of Two Cities", "Bleak House"], 290,
     "Wrote most of his novels as monthly or weekly parts, which shaped their cliffhangers and their crowds of characters. "
     "Edited the magazines Household Words and All the Year Round, where [[Wilkie Collins]] published [[The Woman in White]]. "
     "[[London]] is the setting of nearly everything he wrote."),
    ("H. G. Wells", "H. G. Wells", "Writer", 1866, 1946, "British", ["The Time Machine", "The War of the Worlds", "The Invisible Man"], 260,
     "Trained in biology under Thomas Henry Huxley, Darwin's fiercest defender, and it shows: [[The Time Machine]] is evolution run forward. "
     "Wrote his best-known scientific romances in a burst between 1895 and 1898. See [[Evolution]]."),
    ("Jules Verne", "Jules Verne", "Writer", 1828, 1905, "French", ["Twenty Thousand Leagues Under the Seas", "Around the World in Eighty Days"], 270,
     "Wrote the Voyages extraordinaires, more than fifty novels for the publisher Pierre-Jules Hetzel, mixing travel, geography and engineering. "
     "Lived his last thirty-four years in Amiens. [[Twenty Thousand Leagues Under the Seas]] gave the Nautilus to every later submarine story."),
    ("Robert Louis Stevenson", "Robert Louis Stevenson", "Writer", 1850, 1894, "Scottish", ["Treasure Island", "Strange Case of Dr Jekyll and Mr Hyde"], 310,
     "Born in [[Edinburgh]] to a family of lighthouse engineers. "
     "Wrote [[Strange Case of Dr Jekyll and Mr Hyde]] in a few weeks in 1885, and burned the first draft. "
     "Spent his last years in Samoa, where he is buried."),
    ("Oscar Wilde", "Oscar Wilde", "Writer", 1854, 1900, "Irish", ["The Picture of Dorian Gray"], 320,
     "Playwright, poet and wit; [[The Picture of Dorian Gray]] is his only novel. "
     "It first ran in Lippincott's Monthly Magazine in 1890 and was expanded for the book edition a year later. He died in [[Paris]]."),
    ("Bram Stoker", "Bram Stoker", "Writer", 1847, 1912, "Irish", ["Dracula"], 280,
     "Worked for decades as business manager of the Lyceum Theatre in [[London]] for the actor Henry Irving. "
     "Began [[Dracula]] after a holiday in [[Whitby]] in 1890, where he found the name in a library book."),
    ("Herman Melville", "Herman Melville", "Writer", 1819, 1891, "American", ["Moby-Dick"], 400,
     "Sailed on a whaler in the Pacific in 1841 and drew on it for [[Moby-Dick]]. "
     "The novel sold poorly, and he spent nearly twenty years as a customs inspector in New York."),
    ("George Eliot", "George Eliot", "Writer", 1819, 1880, "British", ["Middlemarch"], 330,
     "The pen name of Mary Ann Evans, translator, editor of the Westminster Review and novelist. "
     "[[Middlemarch]] appeared in eight parts in 1871 and 1872."),
    ("Wilkie Collins", "Wilkie Collins", "Writer", 1824, 1889, "British", ["The Woman in White", "The Moonstone"], 350,
     "Friend and collaborator of [[Charles Dickens]], and a master of the sensation novel. "
     "[[The Moonstone]] is often called the first full-length detective novel in English."),
    ("Lewis Carroll", "Lewis Carroll", "Writer", 1832, 1898, "British", ["Alice's Adventures in Wonderland"], 370,
     "The pen name of Charles Lutwidge Dodgson, a mathematics lecturer at Christ Church, Oxford, and a pioneering photographer. "
     "[[Alice's Adventures in Wonderland]] began as a story told on a boat trip in 1862."),
    ("Ada Lovelace", "Ada Lovelace", "Scientist", 1815, 1852, "British", ["Sketch of the Analytical Engine"], 240,
     "Mathematician and only legitimate child of Lord Byron. "
     "In 1843 she translated Luigi Menabrea's paper on [[Charles Babbage]]'s Analytical Engine and added notes three times its length; see [[Sketch of the Analytical Engine]]. "
     "Note G sets out a procedure to compute Bernoulli numbers, often called the first published program. "
     "She saw that the Engine could act on symbols other than numbers. Central to [[Talk - Ada Lovelace's Note G]] and [[History of computing]]."),
    ("Charles Babbage", "Charles Babbage", "Scientist", 1791, 1871, "British", ["Difference Engine", "Analytical Engine"], 250,
     "Mathematician and engineer who designed the Difference Engine to tabulate polynomials and the Analytical Engine, a general-purpose machine with a store and a mill. "
     "Neither was finished in his lifetime. The Science Museum in [[London]] built Difference Engine No. 2 from his drawings in 1991, and it works. "
     "See [[Why the Engine never got built]] and [[History of computing]]."),
    ("Charles Darwin", "Charles Darwin", "Scientist", 1809, 1882, "British", ["On the Origin of Species"], 230,
     "Sailed as naturalist on HMS Beagle from 1831 to 1836, including five weeks in the [[Galápagos Islands]]. "
     "Published [[On the Origin of Species]] in 1859, more than twenty years after the first tree sketch in [[Darwin's Notebook B]]. Hub: [[Evolution]]."),
    ("Mary Anning", "Mary Anning", "Scientist", 1799, 1847, "British", ["Ichthyosaur", "Plesiosaur"], 220,
     "Fossil collector and palaeontologist at [[Lyme Regis]], who found the first correctly identified ichthyosaur skeleton with her brother Joseph and the first complete plesiosaur in 1823. "
     "The Geological Society did not admit women, and she was rarely credited in print. See [[Fossil walk at Lyme Regis]] and [[Evolution]]."),
    ("Marie Curie", "Marie Curie", "Scientist", 1867, 1934, "Polish-French", ["Radioactivity", "Polonium", "Radium"], 210,
     "Physicist and chemist in [[Paris]]; coined the word radioactivity and discovered polonium and radium with Pierre Curie. "
     "The first person to win two Nobel Prizes, in physics in 1903 and chemistry in 1911. Her notebooks are still radioactive."),
    ("Nikola Tesla", "Nikola Tesla", "Engineer", 1856, 1943, "Serbian-American", ["Induction motor", "Alternating current"], 200,
     "Inventor of the alternating-current induction motor, licensed to George Westinghouse in 1888. "
     "On the other side of the \"war of the currents\" from Thomas Edison's direct current. Planned for [[Podcast - The current wars]]; hub [[Electricity in the nineteenth century]]."),
    ("Florence Nightingale", "Florence Nightingale", "Scientist", 1820, 1910, "British", ["Notes on Nursing", "Polar area diagram"], 205,
     "Nurse in the Crimean War and a statistician: her polar area diagrams of 1858 showed that more soldiers died of preventable disease than of wounds. "
     "First woman elected to the Royal Statistical Society. See [[Notes on Nursing]] and [[Nightingale's rose diagram]]."),
    ("Michael Faraday", "Michael Faraday", "Scientist", 1791, 1867, "British", ["Electromagnetic induction", "Christmas Lectures"], 215,
     "Self-taught chemist and physicist at the Royal Institution in [[London]]. Discovered electromagnetic induction in 1831 and started the Christmas Lectures for young people in 1825. "
     "Corresponded with [[Ada Lovelace]] in the 1840s. See [[Electricity in the nineteenth century]]."),
    ("Luigi Galvani", "Luigi Galvani", "Scientist", 1737, 1798, "Italian", ["Animal electricity"], 225,
     "Physician in Bologna whose frog-leg experiments suggested that animals carry their own electricity. "
     "His nephew Giovanni Aldini toured Europe applying current to the bodies of executed criminals, which is the background to [[Frankenstein]]. See [[Galvani versus Volta]]."),
    ("Claude Monet", "Claude Monet", "Artist", 1840, 1926, "French", ["Impression, Sunrise", "Water Lilies"], 245,
     "His [[Impression, Sunrise]] gave the Impressionists their name, after a mocking review in 1874; see [[Leroy's review of the first exhibition]]. "
     "Painted series of one subject at different hours: haystacks, [[Rouen]] Cathedral, the Houses of Parliament in [[London]], and the water lilies in his garden at [[Giverny]]. See [[Monet's series method]]."),
    ("Vincent van Gogh", "Vincent van Gogh", "Artist", 1853, 1890, "Dutch", ["The Starry Night", "Sunflowers", "Almond Blossoms"], 255,
     "Painted about 860 oil paintings in a decade, most of them in his last two years in [[Arles]] and [[Saint-Rémy-de-Provence]]. "
     "[[The Starry Night]] shows the view from his window at the asylum in Saint-Rémy. His letters to his brother Theo are a record of how he worked."),
    ("Katsushika Hokusai", "Hokusai", "Artist", 1760, 1849, "Japanese", ["The Great Wave off Kanagawa", "Thirty-six Views of Mount Fuji"], 265,
     "Ukiyo-e painter and printmaker who published Thirty-six Views of Mount Fuji in his seventies, around 1831. "
     "The series includes [[The Great Wave off Kanagawa]] and the red Fuji of [[Mount Fuji]]'s note. His prints reached Europe in the 1850s and shaped Monet and Van Gogh."),
    ("Johannes Vermeer", "Johannes Vermeer", "Artist", 1632, 1675, "Dutch", ["Girl with a Pearl Earring", "The Milkmaid", "View of Delft"], 390,
     "Painter in [[Delft]] who left about thirty-four paintings. Almost nothing is known of how he trained. "
     "Seeing [[Girl with a Pearl Earring]] and [[The Milkmaid]] is the point of [[Trip - Amsterdam and Delft]]."),
    ("J. M. W. Turner", "J. M. W. Turner", "Artist", 1775, 1851, "British", ["The Fighting Temeraire", "Rain, Steam and Speed"], 235,
     "Painter of light, weather and the sea, defended by John Ruskin in [[Ruskin's Modern Painters]]. "
     "[[Rain, Steam and Speed]] puts a Great Western Railway train on the Maidenhead bridge in 1844; see [[Essay - Turner and the railway]]."),
]

# ------------------------------------------------------------------- books
# (title, wikipedia title, author, year, genre tags, status, rating, age, created, body)
BOOKS = [
    ("Frankenstein", "Frankenstein", "Mary Shelley", 1818, ["gothic", "science-fiction"], "finished", 5, 95, None,
     "Victor Frankenstein builds a man from parts and abandons him; the creature learns language from a family he watches through a wall, then asks for a companion. "
     "Framed by the letters of an Arctic explorer. The 1831 edition changes Elizabeth's origins and adds [[Shelley's 1831 introduction]]. "
     "Central to [[Essay - Frankenstein and galvanism]] and discussed at [[Reading circle - Frankenstein]]."),
    ("Pride and Prejudice", "Pride and Prejudice", "Jane Austen", 1813, ["novel-of-manners"], "finished", 5, 410, None,
     "Elizabeth Bennet and Mr Darcy misjudge each other and correct themselves. The first sentence does the work of a chapter."),
    ("Emma", "Emma (novel)", "Jane Austen", 1815, ["novel-of-manners"], "finished", 4, 420, None,
     "A matchmaker who gets everything wrong, told so close to her point of view that the reader shares her mistakes."),
    ("Persuasion", "Persuasion (novel)", "Jane Austen", 1817, ["novel-of-manners"], "reading", None, 2, -5,
     "Anne Elliot meets Captain Wentworth again eight years after she broke their engagement. The chapters at [[Lyme Regis]] and the fall from the Cobb are the turn. Halfway through."),
    ("Sense and Sensibility", "Sense and Sensibility", "Jane Austen", 1811, ["novel-of-manners"], "unread", None, 150, None,
     "Austen's first published novel. On the list for [[Reading list for 2027]]."),
    ("Jane Eyre", "Jane Eyre", "Charlotte Brontë", 1847, ["gothic", "bildungsroman"], "finished", 5, 180, None,
     "An orphan governess, a house with a secret on its top floor, and a narrator who talks straight to the reader. Discussed at [[Reading circle - Jane Eyre]]."),
    ("Wuthering Heights", "Wuthering Heights", "Emily Brontë", 1847, ["gothic"], "finished", 4, 520, None,
     "Two houses on the moors and two generations; told at second and third hand by a tenant and a housekeeper, which makes Heathcliff harder to judge."),
    ("Great Expectations", "Great Expectations", "Charles Dickens", 1861, ["bildungsroman"], "finished", 4, 600, None,
     "Pip, the convict on the marshes, Miss Havisham's stopped clocks. Dickens rewrote the ending on a friend's advice."),
    ("A Tale of Two Cities", "A Tale of Two Cities", "Charles Dickens", 1859, ["historical"], "abandoned", 2, 640, None,
     "Stopped at the storming of the Bastille. The opening is better than the middle."),
    ("Bleak House", "Bleak House", "Charles Dickens", 1853, ["mystery"], "unread", None, 130, None,
     "The Jarndyce lawsuit and Inspector Bucket, one of the first detectives in English fiction. Next after [[The Moonstone]]."),
    ("The Time Machine", "The Time Machine", "H. G. Wells", 1895, ["science-fiction"], "finished", 4, 450, None,
     "The Traveller goes to the year 802,701 and finds humanity split into the Eloi and the Morlocks: class and evolution in one image. See [[Evolution]]."),
    ("The War of the Worlds", "The War of the Worlds", "H. G. Wells", 1898, ["science-fiction"], "finished", 4, 470, None,
     "Martians land in Surrey and are killed by bacteria. Wells said the idea came from a walk with his brother about the British conquest of Tasmania."),
    ("The Invisible Man", "The Invisible Man", "H. G. Wells", 1897, ["science-fiction"], "unread", None, 160, None,
     "A chemist who makes himself invisible and cannot undo it."),
    ("Twenty Thousand Leagues Under the Seas", "Twenty Thousand Leagues Under the Seas", "Jules Verne", 1870, ["science-fiction", "adventure"], "reading", None, 1, -3,
     "Professor Aronnax aboard Captain Nemo's Nautilus. Long catalogues of fish between the set pieces. At the Antarctic chapters."),
    ("Around the World in Eighty Days", "Around the World in Eighty Days", "Jules Verne", 1872, ["adventure"], "finished", 3, 500, None,
     "Phileas Fogg's wager, won by the date line."),
    ("Strange Case of Dr Jekyll and Mr Hyde", "Strange Case of Dr Jekyll and Mr Hyde", "Robert Louis Stevenson", 1886, ["gothic"], "finished", 5, 70, None,
     "Short enough for one sitting. The lawyer Utterson as the reader's stand-in, and the last chapter in Jekyll's own words. Discussed at [[Reading circle - Jekyll and Hyde]]."),
    ("Treasure Island", "Treasure Island", "Robert Louis Stevenson", 1883, ["adventure"], "unread", None, 170, None,
     "Began as a map Stevenson drew with his stepson."),
    ("The Picture of Dorian Gray", "The Picture of Dorian Gray", "Oscar Wilde", 1890, ["gothic"], "finished", 4, 380, None,
     "The portrait ages and the man does not. The preface is a list of epigrams answering the critics of the magazine version."),
    ("Dracula", "Dracula", "Bram Stoker", 1897, ["gothic"], "reading", None, 0, -1,
     "Told in diaries, letters, telegrams and phonograph recordings: the newest media of 1897. The [[Whitby]] chapters are the best so far. For [[Reading circle - Dracula]]."),
    ("Moby-Dick", "Moby-Dick", "Herman Melville", 1851, ["adventure"], "abandoned", 2, 700, None,
     "Gave up in the cetology chapters. To try again."),
    ("Middlemarch", "Middlemarch", "George Eliot", 1871, ["novel-of-manners"], "unread", None, 120, None,
     "A provincial town around the Reform Act of 1832. On [[Reading list for 2027]]."),
    ("The Woman in White", "The Woman in White (novel)", "Wilkie Collins", 1859, ["mystery", "sensation"], "finished", 4, 260, None,
     "Several narrators give evidence in turn, as at a trial. Count Fosco is the best villain of the century."),
    ("The Moonstone", "The Moonstone", "Wilkie Collins", 1868, ["mystery"], "unread", None, 6, -6,
     "A diamond stolen from a country house, Sergeant Cuff, and the first full-length English detective novel. Next for [[Gothic reading circle]]."),
    ("Alice's Adventures in Wonderland", "Alice's Adventures in Wonderland", "Lewis Carroll", 1865, ["fantasy"], "finished", 5, 560, None,
     "Logic games dressed as nonsense. John Tenniel's illustrations are part of the text."),
    ("On the Origin of Species", "On the Origin of Species", "Charles Darwin", 1859, ["science"], "reading", None, 3, -4,
     "Reading it slowly, a chapter a week, with [[Darwin's Notebook B]] open beside it. The last paragraph, the \"tangled bank\", is the summary. For [[Talk - Darwin's notebooks]]."),
]

# ------------------------------------------------------------------ places
# (name, image wikipedia title or None, country, kind, visited, age, body)
PLACES = [
    ("London", "The Burning of the Houses of Lords and Commons", "England", "City", True, 190,
     "Home to the Royal Institution, the Science Museum and the National Gallery. "
     "Turner watched the old Palace of Westminster burn on 16 October 1834 and painted the fire twice. Monet painted the new Houses of Parliament from St Thomas' Hospital between 1900 and 1905. "
     "Dickens's city; see [[Charles Dickens]], [[Michael Faraday]] and [[J. M. W. Turner]]."),
    ("Delft", "View of Delft", "Netherlands", "City", False, 30,
     "Vermeer's town. His View of Delft hangs in the Mauritshuis in The Hague, twenty minutes away. A day of [[Trip - Amsterdam and Delft]]."),
    ("Mount Fuji", "Fine Wind, Clear Morning", "Japan", "Mountain", False, 400,
     "Hokusai's Fine Wind, Clear Morning shows the mountain red in late-summer light. For [[Trip - Japan in spring]]; see [[Katsushika Hokusai]]."),
    ("Arles", "Café Terrace at Night", "France", "Town", True, 280,
     "Van Gogh lived here from February 1888 to May 1889 and painted about 200 canvases, including Café Terrace at Night. The café on the Place du Forum is still open."),
    ("Venice", "San Giorgio Maggiore at Dusk", "Italy", "City", True, 330,
     "Monet came in 1908 and painted San Giorgio Maggiore at dusk. [[J. M. W. Turner]] visited three times."),
    ("Paris", "Paris Street; Rainy Day", "France", "City", True, 300,
     "Caillebotte's Paris Street; Rainy Day shows Haussmann's new boulevards in 1877. The city of [[Marie Curie]], the first Impressionist exhibition and [[Oscar Wilde]]'s death."),
    ("Giverny", "Water Lilies (Monet series)", "France", "Village", True, 310,
     "Monet rented a house here in 1883, bought it in 1890 and dug the water-lily pond in 1893. He painted it for the rest of his life. See [[Monet's series method]]."),
    ("Rouen", "Rouen Cathedral (Monet series)", "France", "City", False, 350,
     "Monet rented rooms opposite the cathedral in 1892 and 1893 and painted its west front more than thirty times."),
    ("Saint-Rémy-de-Provence", "Wheat Field with Cypresses", "France", "Town", False, 290,
     "Van Gogh admitted himself to the asylum of Saint-Paul-de-Mausole here in May 1889. [[The Starry Night]] and Wheat Field with Cypresses come from that year."),
    ("Lyme Regis", "Duria Antiquior", "England", "Town", False, 25,
     "A town on the Jurassic Coast where [[Mary Anning]] collected fossils from the cliffs. Austen sets the fall from the Cobb here in [[Persuasion]]. Planned in [[Fossil walk at Lyme Regis]]."),
    ("Haworth", None, "England", "Village", True, 450,
     "The Brontës' village on the edge of the Yorkshire moors. The parsonage is now the Brontë Parsonage Museum."),
    ("Whitby", None, "England", "Town", False, 140,
     "Harbour town on the Yorkshire coast with the ruined abbey on the cliff. Bram Stoker stayed here in 1890; Dracula comes ashore here as a black dog."),
    ("Villa Diodati", None, "Switzerland", "House", False, 260,
     "Byron's rented house on Lake Geneva, where the ghost-story contest of June 1816 produced [[Frankenstein]] and Polidori's The Vampyre."),
    ("Galápagos Islands", None, "Ecuador", "Islands", False, 480,
     "The Beagle stayed five weeks in 1835. Darwin noticed that the mockingbirds differed from island to island, and the finches later became the textbook case. See [[Evolution]]."),
    ("Edinburgh", None, "Scotland", "City", True, 520,
     "Stevenson's birthplace. Deacon Brodie, a respectable cabinet-maker by day and a burglar by night, is one of the sources for Jekyll and Hyde."),
]

# ----------------------------------------------------------------- artworks
# (title, wikipedia title, artist, year, museum, movement, seen, rating, age, body)
ARTWORKS = [
    ("The Starry Night", "The Starry Night", "Vincent van Gogh", "1889", "Museum of Modern Art, New York", "post-impressionism", True, 5, 200,
     "Painted from memory of the view east from his window in [[Saint-Rémy-de-Provence]], with an invented village and a cypress in front."),
    ("Sunflowers", "Sunflowers (Van Gogh series)", "Vincent van Gogh", "1888", "National Gallery, London", "post-impressionism", True, 4, 230,
     "One of the versions painted in [[Arles]] to decorate Gauguin's room in the Yellow House."),
    ("Almond Blossoms", "Almond Blossoms", "Vincent van Gogh", "1890", "Van Gogh Museum, Amsterdam", "post-impressionism", False, None, 35,
     "Painted for his newborn nephew. The flat sky and branches come from Japanese prints. A must for [[Trip - Amsterdam and Delft]]."),
    ("Girl with a Pearl Earring", "Girl with a Pearl Earring", "Johannes Vermeer", "c. 1665", "Mauritshuis, The Hague", "dutch-golden-age", False, None, 33,
     "A tronie, a study of a face and costume, rather than a portrait of a known sitter."),
    ("The Milkmaid", "The Milkmaid (Vermeer)", "Johannes Vermeer", "c. 1658", "Rijksmuseum, Amsterdam", "dutch-golden-age", False, None, 34,
     "A kitchen maid pouring milk. X-rays show Vermeer painted out a clothes basket behind her."),
    ("The Night Watch", "The Night Watch", "Rembrandt", "1642", "Rijksmuseum, Amsterdam", "dutch-golden-age", False, None, 36,
     "A militia company stepping out, painted as action rather than a row of faces."),
    ("The Great Wave off Kanagawa", "The Great Wave off Kanagawa", "Katsushika Hokusai", "c. 1831", "Many collections; prints at the British Museum and the Met", "ukiyo-e", True, 5, 260,
     "A woodblock print, so thousands were made. Mount Fuji sits small in the trough of the wave."),
    ("Impression, Sunrise", "Impression, Sunrise", "Claude Monet", "1872", "Musée Marmottan Monet, Paris", "impressionism", True, 5, 240,
     "The harbour of Le Havre in morning mist. The title gave the movement its name; see [[Leroy's review of the first exhibition]]."),
    ("The Fighting Temeraire", "The Fighting Temeraire", "J. M. W. Turner", "1839", "National Gallery, London", "romanticism", True, 5, 220,
     "A steam tug pulls a warship from Trafalgar up the Thames to be broken up, under a burning sunset."),
    ("Rain, Steam and Speed", "Rain, Steam and Speed – The Great Western Railway", "J. M. W. Turner", "1844", "National Gallery, London", "romanticism", True, 4, 215,
     "A train crosses the Maidenhead Railway Bridge in rain. A hare runs ahead of it on the tracks. See [[Essay - Turner and the railway]]."),
    ("Wanderer above the Sea of Fog", "Wanderer above the Sea of Fog", "Caspar David Friedrich", "c. 1818", "Hamburger Kunsthalle", "romanticism", False, None, 270,
     "A man from behind on a rocky summit, looking over fog. The same year as [[Frankenstein]]."),
    ("The Hay Wain", "The Hay Wain", "John Constable", "1821", "National Gallery, London", "romanticism", True, 3, 290,
     "A cart in the river Stour by Willy Lott's cottage in Suffolk. It won a gold medal at the Paris Salon of 1824."),
    ("Bal du moulin de la Galette", "Bal du moulin de la Galette", "Pierre-Auguste Renoir", "1876", "Musée d'Orsay, Paris", "impressionism", False, None, 300,
     "A Sunday dance in Montmartre, with dappled light through the trees."),
    ("A Sunday on La Grande Jatte", "A Sunday Afternoon on the Island of La Grande Jatte", "Georges Seurat", "1884–1886", "Art Institute of Chicago", "neo-impressionism", False, None, 310,
     "Painted in small dots of pure color over two years. Seurat later added a painted border of dots."),
]

# ---------------------------------------------------------------- projects
# (title, image wikipedia title or None, status, area, due offset in days from today
#  (positive is in the future) or None, progress, people, age, created, body)
PROJECTS = [
    ("Essay - Frankenstein and galvanism", "Galvanism", "active", "Writing", 4, 60, ["Mary Shelley", "Luigi Galvani"], 0, -12,
     "An essay for the newsletter on what Mary Shelley could have known about electricity and life in 1816.\n\n"
     "- [x] Read [[Shelley's 1831 introduction]]\n- [x] Notes on Aldini's demonstrations in [[Galvani versus Volta]]\n- [ ] Draft the middle section\n- [ ] Find the 1803 newspaper account of the Forster experiment\n- [ ] Send to the editor\n\n"
     "Related: [[Frankenstein]], [[Electricity in the nineteenth century]], [[Gothic fiction]]."),
    ("Talk - Ada Lovelace's Note G", "Note G", "active", "Talks", 6, 35, ["Ada Lovelace", "Charles Babbage"], 1, -20,
     "Twenty minutes for the local history society on what Note G computes and why it matters.\n\n"
     "- [x] Reread [[Sketch of the Analytical Engine]]\n- [ ] Redraw the table of operations as a diagram\n- [ ] Rehearse with [[Talk rehearsal - Note G]]\n- [ ] Slides\n\n"
     "See [[History of computing]] and [[Why the Engine never got built]]."),
    ("Gothic reading circle", "The Nightmare", "active", "Reading", 2, 70, ["Mary Shelley", "Bram Stoker"], 1, -200,
     "Five friends, one gothic novel a month, meeting at the library. Notes from each session are in Meetings.\n\n"
     "- [x] [[Frankenstein]]\n- [x] [[Jane Eyre]]\n- [x] [[Strange Case of Dr Jekyll and Mr Hyde]]\n- [ ] [[Dracula]], next session\n- [ ] Vote on [[The Moonstone]] or The Monk\n\n"
     "Hub: [[Gothic fiction]]."),
    ("Newsletter - Victorian science, issue 12", "The Great Exhibition", "active", "Writing", -3, 80, ["Michael Faraday", "Marie Curie"], 4, -30,
     "Issue 12 of the monthly newsletter. Late: the essay is not ready.\n\n"
     "- [x] Lead item on [[Michael Faraday]]'s Christmas Lectures\n- [x] Book note on [[On the Origin of Species]]\n- [ ] Include [[Essay - Frankenstein and galvanism]] or hold it for issue 13\n- [ ] Send\n\n"
     "Agreed with the editor in [[Editor call - newsletter]]."),
    ("Trip - Amsterdam and Delft", "The Threatened Swan", "active", "Travel", 21, 50, ["Johannes Vermeer", "Vincent van Gogh"], 2, -40,
     "Four days in November: the Rijksmuseum, the Van Gogh Museum, a day trip to [[Delft]] and the Mauritshuis.\n\n"
     "- [x] Hotel\n- [x] Rijksmuseum tickets for [[The Night Watch]] and [[The Milkmaid]]\n- [ ] Van Gogh Museum slot for [[Almond Blossoms]]\n- [ ] Train to The Hague for [[Girl with a Pearl Earring]]\n\n"
     "Planned with the curator in [[Curator call - Rijksmuseum]]."),
    ("Talk - Darwin's notebooks", "HMS Beagle", "waiting", "Talks", 12, 20, ["Charles Darwin"], 9, -60,
     "A talk on the transmutation notebooks of 1837 and 1838. Waiting for the society to confirm a date.\n\n"
     "- [x] Read [[Darwin's Notebook B]]\n- [ ] Reread [[On the Origin of Species]] chapter four\n- [ ] Ask about a projector\n\nHub: [[Evolution]]."),
    ("Podcast - The current wars", "War of the currents", "waiting", "Talks", -10, 15, ["Nikola Tesla"], 20, -90,
     "An episode with a co-host on Tesla, Edison and Westinghouse. Waiting on the co-host's research notes, now late.\n\n"
     "- [x] Outline\n- [ ] Research notes from co-host\n- [ ] Record\n\nSee [[Podcast planning - current wars]] and [[Electricity in the nineteenth century]]."),
    ("Fossil walk at Lyme Regis", "Ichthyosaurus", "waiting", "Travel", 30, 10, ["Mary Anning"], 15, -45,
     "A guided fossil walk on the beach at [[Lyme Regis]], then the Philpot Museum. Waiting for spring dates.\n\n"
     "- [ ] Book the walk\n- [ ] Read Mary Anning's surviving letters\n- [ ] Reread the Lyme chapters of [[Persuasion]]"),
    ("Trip - Japan in spring", "Kajikazawa in Kai Province", "someday", "Travel", None, 0, ["Katsushika Hokusai"], 120, -300,
     "Fuji from the lakes, the Sumida Hokusai Museum in Tokyo, and the cherry blossom. Someday.\n\nSee [[Mount Fuji]] and [[The Great Wave off Kanagawa]]."),
    ("Reading list for 2027", None, "someday", "Reading", None, 0, [], 40, -40,
     "- [[Middlemarch]]\n- [[Bleak House]]\n- [[Sense and Sensibility]]\n- [[Moby-Dick]], a second attempt\n- [[Treasure Island]]"),
    ("Nightingale's rose diagram", None, "done", "Writing", -60, 100, ["Florence Nightingale"], 55, -120,
     "Redrew the 1858 polar area diagram from the original figures for the newsletter. Done and published in issue 10.\n\nSee [[Notes on Nursing]]."),
    ("Essay - Turner and the railway", None, "done", "Writing", -100, 100, ["J. M. W. Turner"], 95, -150,
     "On [[Rain, Steam and Speed]] and what the Great Western Railway meant in 1844. Published in issue 9.\n\nSources: [[Ruskin's Modern Painters]]."),
    ("Catalogue Monet's series", "Haystacks (Monet series)", "done", "Research", -150, 100, ["Claude Monet"], 140, -200,
     "A list of every series with dates and locations, for [[Monet's series method]]."),
]

# ---------------------------------------------------------------- research
# Topics are hubs; sources carry status, year and a summary or none.
TOPICS = [
    ("History of computing", 230,
     "From tables to programs.\n\n## People\n[[Charles Babbage]], [[Ada Lovelace]], [[Michael Faraday]] (as Lovelace's correspondent)\n\n"
     "## Sources\n[[Sketch of the Analytical Engine]], [[Why the Engine never got built]]\n\n"
     "## Work\n[[Talk - Ada Lovelace's Note G]], [[Talk rehearsal - Note G]]\n\n"
     "## Threads\n[[Electricity in the nineteenth century]], [[Nightingale's rose diagram]] (data as argument), [[Telegraph and the novel]]"),
    ("Gothic fiction", 250,
     "The novels of terror and the uncanny, 1764 to 1897.\n\n## Novels\n[[Frankenstein]], [[Jane Eyre]], [[Wuthering Heights]], [[Strange Case of Dr Jekyll and Mr Hyde]], "
     "[[The Picture of Dorian Gray]], [[Dracula]], [[The Woman in White]]\n\n## Writers\n[[Mary Shelley]], [[Charlotte Brontë]], [[Emily Brontë]], [[Robert Louis Stevenson]], [[Oscar Wilde]], [[Bram Stoker]]\n\n"
     "## Places\n[[Villa Diodati]], [[Whitby]], [[Haworth]], [[Edinburgh]]\n\n## Work\n[[Gothic reading circle]], [[Essay - Frankenstein and galvanism]]"),
    ("Evolution", 240,
     "How the idea arrived and spread.\n\n## People\n[[Charles Darwin]], [[Mary Anning]], [[H. G. Wells]]\n\n## Sources\n[[On the Origin of Species]], [[Darwin's Notebook B]]\n\n"
     "## Places\n[[Galápagos Islands]], [[Lyme Regis]]\n\n## Fiction\n[[The Time Machine]], [[The War of the Worlds]]\n\n## Work\n[[Talk - Darwin's notebooks]], [[Fossil walk at Lyme Regis]]"),
    ("Impressionism", 260,
     "The painters who left the studio for the light.\n\n## Painters\n[[Claude Monet]], [[Vincent van Gogh]] (after), [[J. M. W. Turner]] (before)\n\n"
     "## Works\n[[Impression, Sunrise]], [[Bal du moulin de la Galette]], [[A Sunday on La Grande Jatte]], [[The Starry Night]], [[Sunflowers]]\n\n"
     "## Places\n[[Giverny]], [[Rouen]], [[Arles]], [[Paris]]\n\n## Notes\n[[Monet's series method]], [[Leroy's review of the first exhibition]], [[Catalogue Monet's series]], [[Japanese prints in Paris]]"),
    ("Electricity in the nineteenth century", 245,
     "From frogs' legs to power stations.\n\n## People\n[[Luigi Galvani]], [[Michael Faraday]], [[Nikola Tesla]], [[Marie Curie]]\n\n"
     "## Notes\n[[Galvani versus Volta]], [[Telegraph and the novel]], [[Gaslight and reading hours]]\n\n## Work\n[[Essay - Frankenstein and galvanism]], [[Podcast - The current wars]], [[Newsletter - Victorian science, issue 12]]"),
]

# (title, image wikipedia title or None, status, year, topic, summary or None, age, body)
SOURCES = [
    ("Sketch of the Analytical Engine", "Ada Lovelace", "read", "1843", "History of computing",
     "Menabrea's paper on Babbage's Engine, translated by Lovelace with notes A to G.", 230,
     "Notes A to G run to about three times the length of the paper. Note G computes Bernoulli numbers. See [[Ada Lovelace]] and [[Talk - Ada Lovelace's Note G]]."),
    ("Shelley's 1831 introduction", None, "read", "1831", "Gothic fiction",
     "Mary Shelley's account of how Frankenstein began, written for the revised edition.", 210,
     "Describes the conversations about galvanism and the \"waking dream\" that gave her the image of the creature. For [[Essay - Frankenstein and galvanism]]."),
    ("Darwin's Notebook B", "Charles Darwin", "read", "1837", "Evolution",
     "The transmutation notebook with the first tree-of-life sketch, headed \"I think\".", 225,
     "Begun in July 1837, after the Beagle. Page 36 has the branching sketch. See [[Charles Darwin]] and [[Talk - Darwin's notebooks]]."),
    ("Ruskin's Modern Painters", None, "read", "1843", "Impressionism",
     "Ruskin's defense of Turner against his critics, which grew to five volumes.", 280,
     "Volume one argues that [[J. M. W. Turner]] paints nature more truly than the old masters."),
    ("Leroy's review of the first exhibition", None, "read", "1874", "Impressionism", None, 270,
     "Louis Leroy's satirical piece in Le Charivari, written as a dialogue at the exhibition, used Monet's title to mock the group as \"Impressionists\". See [[Impression, Sunrise]]."),
    ("Notes on Nursing", "Florence Nightingale", "unread", "1859", "History of computing", None, 190,
     "Nightingale's short book for anyone nursing at home. See [[Florence Nightingale]]."),
    ("Experimental Researches in Electricity", "Michael Faraday", "unread", "1839", "Electricity in the nineteenth century", None, 200,
     "Faraday's collected papers, in three volumes. See [[Michael Faraday]]."),
    ("The Voyage of the Beagle", "HMS Beagle", "unread", "1839", "Evolution",
     "Darwin's travel journal of the survey voyage, popular twenty years before the Origin.", 185,
     "Read the Galápagos chapter first. See [[Galápagos Islands]]."),
]

# Research notes: (title, age, body). Short, lightly linked ones are Rediscover's "unfinished".
NOTES = [
    ("Why the Engine never got built", 228,
     "Babbage fell out with his engineer Joseph Clement over money in 1833, and the government stopped funding the Difference Engine in 1842 after spending about £17,000. "
     "He kept redesigning instead of finishing. The working Difference Engine No. 2 built in 1991 shows the design was sound. See [[Charles Babbage]] and [[History of computing]]."),
    ("Galvani versus Volta", 205,
     "Galvani thought the frog's muscle held animal electricity; Volta thought the two metals made the current, and built the pile in 1800 to prove it. Both were partly right. "
     "Aldini's public experiments of 1803 in [[London]] on the body of George Forster are the likely image behind [[Frankenstein]]. See [[Luigi Galvani]]."),
    ("Monet's series method", 238,
     "Monet worked on many canvases at once, switching as the light changed, and finished them in the studio. "
     "Series: haystacks (1890–91), poplars, [[Rouen]] Cathedral (1892–94), the Houses of Parliament in [[London]] (1900–05) and the water lilies at [[Giverny]]. See [[Claude Monet]] and [[Catalogue Monet's series]]."),
    ("Japanese prints in Paris", 330,
     "Japonisme: after Japan opened its ports in the 1850s, prints by [[Katsushika Hokusai]] and Hiroshige reached Paris as packing paper and then as art."),
    ("Telegraph and the novel", 420, "Do novels speed up after the telegraph? Check [[Dracula]]."),
    ("Gaslight and reading hours", 440, "Gas lighting lengthened the evening. Did it change what people read, or how long the novels were?"),
    ("Spiritualism and science", 460, "Faraday tested table-turning in 1853 and found the sitters moved the table themselves."),
    ("The Cobb in Persuasion", 3, "Louisa Musgrove jumps from the steps of the Cobb and falls. Compare the place with the text when I go to [[Lyme Regis]]."),
]

# ---------------------------------------------------------------- meetings
# (title, date offset days ago, attendees, project link, body, created offset or None)
MEETINGS = [
    ("Reading circle - Frankenstein", 190, ["Ana", "Tom", "Priya", "Walt"], "Gothic reading circle",
     "Agreed the creature is the most sympathetic character. Walt argued Victor never sleeps. Priya brought the 1831 text; we compared the endings. Next: [[Jane Eyre]]."),
    ("Reading circle - Jane Eyre", 160, ["Ana", "Tom", "Priya"], "Gothic reading circle",
     "Long talk about Bertha Mason and Wide Sargasso Sea. Next: [[Strange Case of Dr Jekyll and Mr Hyde]]."),
    ("Reading circle - Jekyll and Hyde", 70, ["Ana", "Tom", "Priya", "Walt", "June"], "Gothic reading circle",
     "June joined. The letters chapter is the best. Stevenson's Edinburgh is in every street description. Next: [[Dracula]]."),
    ("Reading circle - Dracula", -2, ["Ana", "Tom", "Priya", "Walt", "June"], "Gothic reading circle",
     "Upcoming. Questions to bring: why so many recording devices? Is Mina the real hero?"),
    ("Editor call - newsletter", 8, ["Sam (editor)"], "Newsletter - Victorian science, issue 12",
     "Issue 12 slips a week. The galvanism essay can lead issue 13 if it is not ready."),
    ("Curator call - Rijksmuseum", 12, ["Mara (curator)"], "Trip - Amsterdam and Delft",
     "Mara suggested the early slot for The Night Watch and the print room by appointment."),
    ("Talk rehearsal - Note G", 1, ["Tom"], "Talk - Ada Lovelace's Note G",
     "Too long by six minutes. Cut the Difference Engine history; start with the table."),
    ("Podcast planning - current wars", 35, ["Lee (co-host)"], "Podcast - The current wars",
     "Split the research: Lee takes Edison and the electric chair, I take Tesla and Westinghouse."),
]

# Notes that should come up in "On this day": edited in this week of an earlier year.
# (folder, title, years ago, days offset from today's date, body)
ON_THIS_DAY = [
    ("Meetings", "Reading circle - first meeting", 2, -1,
     "The first meeting of the [[Gothic reading circle]]. Chose [[Frankenstein]] to start. Five of us, the library's back room."),
    ("Ideas", "A map of literary London", 3, 1,
     "Pin every novel's addresses on one map of [[London]]: Baker Street, the Inns of Court in [[Bleak House]], Dr Jekyll's house."),
    ("Journal", "Visit to the National Gallery", 1, 4,
     "Stood in front of [[The Fighting Temeraire]] for twenty minutes. Then [[Rain, Steam and Speed]] next door. Started thinking about the railway essay."),
    ("Ideas", "Fossils in fiction", 4, 7, "Dickens opens [[Bleak House]] with a Megalosaurus in Holborn. More examples?"),
]

# ------------------------------------------------------------------ ideas
# (title, age, body) Old and short; some unlinked.
IDEAS = [
    ("Novels told in documents", 300, "[[Dracula]], [[The Woman in White]], [[Frankenstein]]'s letters. A list of epistolary and documentary novels."),
    ("A walking tour of Dickens's London", 420, "Start at Doughty Street, end at the Old Curiosity Shop."),
    ("Women scientists the Royal Society ignored", 380, "[[Mary Anning]], Caroline Herschel, Mary Somerville."),
    ("Board game of the Beagle voyage", 500, "Players collect specimens and argue with FitzRoy."),
    ("Color of the 1870s", 520, "Which new pigments did the Impressionists have that Turner did not?"),
    ("Hokusai's age", 360, "He said nothing he drew before seventy was worth noticing."),
    ("A reading map of the Brontës", 470, "Haworth, Cowan Bridge, Brussels, Scarborough."),
    ("The Nautilus as a library", 410, "Nemo's twelve thousand books. What would be on the shelf?"),
    ("Lighthouse families", 560, "The Stevensons built many of Scotland's lighthouses."),
    ("Short stories by Wells", 600, "The Country of the Blind; The Star; The Door in the Wall."),
]

# ------------------------------------------------------------------ journal
# (days ago, body). Each day's note links what was worked on.
JOURNAL = [
    (0, "Finished the Lyme Regis chapters of [[Persuasion]]. Tidied the reading list for [[Gothic reading circle]]."),
    (1, "Rehearsed the talk with Tom: see [[Talk rehearsal - Note G]]. Too long. Cut the history."),
    (2, "Booked trains for [[Trip - Amsterdam and Delft]]. The Mauritshuis opens at ten."),
    (3, "A chapter of [[On the Origin of Species]] with [[Darwin's Notebook B]] beside it. Started [[The Cobb in Persuasion]]."),
    (4, "Issue 12 is late. Wrote to the editor about the essay."),
    (6, "Drafted the opening of [[Essay - Frankenstein and galvanism]]."),
    (8, "Call with the editor: [[Editor call - newsletter]]."),
    (11, "Read about Aldini's demonstrations for [[Galvani versus Volta]]."),
    (12, "Call with Mara at the Rijksmuseum: [[Curator call - Rijksmuseum]]."),
    (15, "Wrote to the Lyme Regis museum about fossil walks."),
    (19, "Started the slides for [[Talk - Ada Lovelace's Note G]]."),
    (24, "Rainy Sunday. Finished [[Strange Case of Dr Jekyll and Mr Hyde]] again for the circle."),
    (29, "Sorted the Gallery notes. Twelve paintings I have seen or want to see."),
    (35, "Planned the podcast with Lee: [[Podcast planning - current wars]]."),
    (41, "Started planning [[Trip - Amsterdam and Delft]]."),
    (48, "Bought a secondhand Origin, the sixth edition."),
    (55, "Published [[Nightingale's rose diagram]] in issue 10."),
    (63, "Reread [[Jane Eyre]]'s first chapters for no reason."),
    (70, "Reading circle on Jekyll and Hyde. June joined."),
    (82, "Visited the Science Museum's Difference Engine."),
    (95, "Published [[Essay - Turner and the railway]]."),
    (104, "Finished [[Frankenstein]] for the third time."),
    (118, "Sketched an index of the Monet series: [[Catalogue Monet's series]]."),
]

PINNED = ["Welcome.md", "Research/Gothic fiction.md", "Research/History of computing.md"]

# Every image to fetch, as (slug, wikipedia title).
def slug(s):
    import re, unicodedata
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")

IMAGE_TITLES = (
    [(slug(p[0]), p[1]) for p in PEOPLE]
    + [(slug(b[0]) + "-cover", b[1]) for b in BOOKS]
    + [(slug(p[0]) + "-view", p[1]) for p in PLACES if p[1]]
    + [(slug(a[0]) + "-art", a[1]) for a in ARTWORKS]
    + [(slug(p[0]) + "-banner", p[1]) for p in PROJECTS if p[1]]
)
