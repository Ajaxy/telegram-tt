const DATA = `AF🇦🇫93Afghanistan
AO🇦🇴244Angola
AL🇦🇱355Albania
AD🇦🇩376Andorra
AE🇦🇪971United Arab Emirates
AR🇦🇷54Argentina
AM🇦🇲374Armenia
AG🇦🇬1268Antigua and Barbuda
AU🇦🇺61Australia
AT🇦🇹43Austria
AZ🇦🇿994Azerbaijan
BI🇧🇮257Burundi
BE🇧🇪32Belgium
BJ🇧🇯229Benin
BF🇧🇫226Burkina Faso
BD🇧🇩880Bangladesh
BG🇧🇬359Bulgaria
BH🇧🇭973Bahrain
BS🇧🇸1242Bahamas
BA🇧🇦387Bosnia and Herzegovina
BY🇧🇾375Belarus
BZ🇧🇿501Belize
BO🇧🇴591Bolivia
BR🇧🇷55Brazil
BB🇧🇧1246Barbados
BN🇧🇳673Brunei
BT🇧🇹975Bhutan
BW🇧🇼267Botswana
CF🇨🇫236Central African Republic
CA🇨🇦1Canada
CH🇨🇭41Switzerland
CL🇨🇱56Chile
CN🇨🇳86China
CI🇨🇮225Ivory Coast
CM🇨🇲237Cameroon
CD🇨🇩243DR Congo
CG🇨🇬242Republic of the Congo
CO🇨🇴57Colombia
KM🇰🇲269Comoros
CV🇨🇻238Cape Verde
CR🇨🇷506Costa Rica
CU🇨🇺53Cuba
CY🇨🇾357Cyprus
CZ🇨🇿420Czechia
DE🇩🇪49Germany
DJ🇩🇯253Djibouti
DM🇩🇲1767Dominica
DK🇩🇰45Denmark
DO🇩🇴1Dominican Republic
DZ🇩🇿213Algeria
EC🇪🇨593Ecuador
EG🇪🇬20Egypt
ER🇪🇷291Eritrea
ES🇪🇸34Spain
EE🇪🇪372Estonia
ET🇪🇹251Ethiopia
FI🇫🇮358Finland
FJ🇫🇯679Fiji
FR🇫🇷33France
FM🇫🇲691Micronesia
GA🇬🇦241Gabon
GB🇬🇧44United Kingdom
GE🇬🇪995Georgia
GH🇬🇭233Ghana
GN🇬🇳224Guinea
GM🇬🇲220Gambia
GW🇬🇼245Guinea-Bissau
GQ🇬🇶240Equatorial Guinea
GR🇬🇷30Greece
GD🇬🇩1473Grenada
GT🇬🇹502Guatemala
GY🇬🇾592Guyana
HN🇭🇳504Honduras
HR🇭🇷385Croatia
HT🇭🇹509Haiti
HU🇭🇺36Hungary
ID🇮🇩62Indonesia
IN🇮🇳91India
IE🇮🇪353Ireland
IR🇮🇷98Iran
IQ🇮🇶964Iraq
IS🇮🇸354Iceland
IL🇮🇱972Israel
IT🇮🇹39Italy
JM🇯🇲1876Jamaica
JO🇯🇴962Jordan
JP🇯🇵81Japan
KZ🇰🇿7Kazakhstan
KE🇰🇪254Kenya
KG🇰🇬996Kyrgyzstan
KH🇰🇭855Cambodia
KI🇰🇮686Kiribati
KN🇰🇳1869Saint Kitts and Nevis
KR🇰🇷82South Korea
KW🇰🇼965Kuwait
LA🇱🇦856Laos
LB🇱🇧961Lebanon
LR🇱🇷231Liberia
LY🇱🇾218Libya
LC🇱🇨1758Saint Lucia
LI🇱🇮423Liechtenstein
LK🇱🇰94Sri Lanka
LS🇱🇸266Lesotho
LT🇱🇹370Lithuania
LU🇱🇺352Luxembourg
LV🇱🇻371Latvia
MA🇲🇦212Morocco
MC🇲🇨377Monaco
MD🇲🇩373Moldova
MG🇲🇬261Madagascar
MV🇲🇻960Maldives
MX🇲🇽52Mexico
MH🇲🇭692Marshall Islands
MK🇲🇰389North Macedonia
ML🇲🇱223Mali
MT🇲🇹356Malta
MM🇲🇲95Myanmar
ME🇲🇪382Montenegro
MN🇲🇳976Mongolia
MZ🇲🇿258Mozambique
MR🇲🇷222Mauritania
MU🇲🇺230Mauritius
MW🇲🇼265Malawi
MY🇲🇾60Malaysia
NA🇳🇦264Namibia
NE🇳🇪227Niger
NG🇳🇬234Nigeria
NI🇳🇮505Nicaragua
NL🇳🇱31Netherlands
NO🇳🇴47Norway
NP🇳🇵977Nepal
NR🇳🇷674Nauru
NZ🇳🇿64New Zealand
OM🇴🇲968Oman
PK🇵🇰92Pakistan
PA🇵🇦507Panama
PE🇵🇪51Peru
PH🇵🇭63Philippines
PW🇵🇼680Palau
PG🇵🇬675Papua New Guinea
PL🇵🇱48Poland
KP🇰🇵850North Korea
PT🇵🇹351Portugal
PY🇵🇾595Paraguay
QA🇶🇦974Qatar
RO🇷🇴40Romania
RU🇷🇺7Russia
RW🇷🇼250Rwanda
SA🇸🇦966Saudi Arabia
SD🇸🇩249Sudan
SN🇸🇳221Senegal
SG🇸🇬65Singapore
SB🇸🇧677Solomon Islands
SL🇸🇱232Sierra Leone
SV🇸🇻503El Salvador
SM🇸🇲378San Marino
SO🇸🇴252Somalia
RS🇷🇸381Serbia
SS🇸🇸211South Sudan
ST🇸🇹239São Tomé and Príncipe
SR🇸🇷597Suriname
SK🇸🇰421Slovakia
SI🇸🇮386Slovenia
SE🇸🇪46Sweden
SZ🇸🇿268Eswatini
SC🇸🇨248Seychelles
SY🇸🇾963Syria
TD🇹🇩235Chad
TG🇹🇬228Togo
TH🇹🇭66Thailand
TJ🇹🇯992Tajikistan
TM🇹🇲993Turkmenistan
TL🇹🇱670Timor-Leste
TO🇹🇴676Tonga
TT🇹🇹1868Trinidad and Tobago
TN🇹🇳216Tunisia
TR🇹🇷90Turkey
TV🇹🇻688Tuvalu
TZ🇹🇿255Tanzania
UG🇺🇬256Uganda
UA🇺🇦380Ukraine
UY🇺🇾598Uruguay
US🇺🇸1United States
UZ🇺🇿998Uzbekistan
VA🇻🇦3Vatican City
VC🇻🇨1784Saint Vincent and the Grenadines
VE🇻🇪58Venezuela
VN🇻🇳84Vietnam
VU🇻🇺678Vanuatu
WS🇼🇸685Samoa
YE🇾🇪967Yemen
ZA🇿🇦27South Africa
ZM🇿🇲260Zambia
ZW🇿🇼263Zimbabwe`;

const parsed = DATA
  .split('\n')
  .map((str) => {
    const id = str.substr(0, 2);
    const flag = str.substr(2, 4);
    const code = `+${str.match(/\d+/)![0]}`;
    const name = str.split(/\d+/)[1];

    return {
      id, flag, code, name,
    };
  });

export default parsed;
