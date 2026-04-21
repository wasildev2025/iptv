export type MetadataCatalogEntry = {
  brand: string;
  tvgId?: string;
  aliases: string[];
  logoCandidates: string[];
};

const WIKIMEDIA = 'https://commons.wikimedia.org/wiki/Special:Redirect/file/';
const IPTV_ORG = 'https://raw.githubusercontent.com/iptv-org/logo/master/';

export const METADATA_CATALOG: MetadataCatalogEntry[] = [
  {
    brand: 'MBC 1',
    tvgId: 'mbc1.ae',
    aliases: ['mbc1', 'mbc 1', 'ar mbc1', 'mbc one'],
    logoCandidates: [
      `${IPTV_ORG}MBC%201.png`,
      `${WIKIMEDIA}MBC%201%20Logo.svg`,
      `${WIKIMEDIA}Mbc1logo.png`,
    ],
  },
  {
    brand: 'MBC 2',
    tvgId: 'mbc2.ae',
    aliases: ['mbc2', 'mbc 2', 'mbc two'],
    logoCandidates: [
      `${IPTV_ORG}MBC%202.png`,
      `${WIKIMEDIA}MBC%202%20Logo.svg`,
    ],
  },
  {
    brand: 'MBC 3',
    tvgId: 'mbc3.ae',
    aliases: ['mbc3', 'mbc 3'],
    logoCandidates: [
      `${IPTV_ORG}MBC%203.png`,
      `${WIKIMEDIA}MBC%203%20Logo.svg`,
    ],
  },
  {
    brand: 'MBC 4',
    tvgId: 'mbc4.ae',
    aliases: ['mbc4', 'mbc 4'],
    logoCandidates: [
      `${IPTV_ORG}MBC%204.png`,
      `${WIKIMEDIA}MBC%204%20Logo.svg`,
    ],
  },
  {
    brand: 'MBC Action',
    tvgId: 'mbcaction.ae',
    aliases: ['mbc action', 'mbcaction'],
    logoCandidates: [
      `${IPTV_ORG}MBC%20Action.png`,
      `${WIKIMEDIA}MBC%20Action%20Logo.svg`,
    ],
  },
  {
    brand: 'MBC Max',
    tvgId: 'mbcmax.ae',
    aliases: ['mbc max', 'mbcmax'],
    logoCandidates: [
      `${IPTV_ORG}MBC%20Max.png`,
      `${WIKIMEDIA}MBC%20Max%20Logo.svg`,
    ],
  },
  {
    brand: 'Kuwait TV 1',
    tvgId: 'kuwait1.kw',
    aliases: ['kuwait 1', 'kuwait tv 1', 'ktv1', 'ktv 1', 'kuwait one'],
    logoCandidates: [
      `${IPTV_ORG}KTV%201.png`,
      `${WIKIMEDIA}KTV1%20logo.png`,
    ],
  },
  {
    brand: 'KTV 2',
    tvgId: 'ktv2.kw',
    aliases: ['kuwait 2', 'kuwait tv 2', 'ktv2', 'ktv 2'],
    logoCandidates: [
      `${IPTV_ORG}KTV%202.png`,
      `${WIKIMEDIA}KTV2%20logo.png`,
    ],
  },
  {
    brand: 'Al Jazeera',
    tvgId: 'aljazeera.qa',
    aliases: ['al jazeera', 'aljazeera', 'al jazeera news'],
    logoCandidates: [
      `${IPTV_ORG}Al%20Jazeera.png`,
      `${WIKIMEDIA}Al_Jazeera_Logo.svg`,
    ],
  },
  {
    brand: 'Al Arabiya',
    tvgId: 'alarabiya.ae',
    aliases: ['al arabiya', 'alarabiya'],
    logoCandidates: [
      `${IPTV_ORG}Al%20Arabiya.png`,
      `${WIKIMEDIA}Alarabiya_new_logo.svg`,
    ],
  },
  {
    brand: 'BBC News',
    tvgId: 'bbcnews.uk',
    aliases: ['bbc news', 'bbcnews', 'bbc news hd'],
    logoCandidates: [
      `${IPTV_ORG}BBC%20News.png`,
      `${WIKIMEDIA}BBC_News_2022_(Alt).svg`,
    ],
  },
  {
    brand: 'CNN International',
    tvgId: 'cnninternational.us',
    aliases: ['cnn', 'cnn international', 'cnn intl'],
    logoCandidates: [
      `${IPTV_ORG}CNN%20International.png`,
      `${WIKIMEDIA}CNN.svg`,
    ],
  },
  {
    brand: 'Discovery Channel',
    tvgId: 'discoverychannel.us',
    aliases: ['discovery', 'discovery channel'],
    logoCandidates: [
      `${IPTV_ORG}Discovery%20Channel.png`,
      `${WIKIMEDIA}Discovery_Channel_logo.svg`,
    ],
  },
  {
    brand: 'National Geographic',
    tvgId: 'natgeo.us',
    aliases: ['nat geo', 'natgeo', 'national geographic'],
    logoCandidates: [
      `${IPTV_ORG}National%20Geographic.png`,
      `${WIKIMEDIA}National_Geographic_Channel.svg`,
    ],
  },
  {
    brand: 'Cartoon Network Arabic',
    tvgId: 'cartoonnetworkarabic.ae',
    aliases: ['cartoon network', 'cartoon network arabic', 'cn arabic'],
    logoCandidates: [
      `${IPTV_ORG}Cartoon%20Network%20Arabic.png`,
      `${WIKIMEDIA}Cartoon_Network_Arabic_logo.png`,
    ],
  },
];
