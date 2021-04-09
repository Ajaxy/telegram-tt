import useReducer, { StateReducer, Dispatch } from '../useReducer';
import { countryList } from '../../util/phoneNumber';

export type FormState = {
  streetLine1: string;
  streetLine2: string;
  city: string;
  state: string;
  countryIso2: string;
  postCode: string;
  fullName: string;
  email: string;
  phone: string;
  shipping: string;
  cardNumber: string;
  cardholder: string;
  expiry: string;
  cvv: string;
  billingCountry: string;
  billingZip: string;
  saveInfo: boolean;
  saveCredentials: boolean;
  formErrors: Record<string, string>;
};

export type FormActions = (
  'changeAddress1' | 'changeAddress2' | 'changeCity' | 'changeState' | 'changeCountry' |
  'changePostCode' | 'changeFullName' | 'changeEmail' | 'changePhone' | 'changeShipping' | 'updateUserInfo' |
  'changeCardNumber' | 'changeCardholder' | 'changeExpiryDate' | 'changeCvvCode' | 'changeBillingCountry' |
  'changeBillingZip' | 'changeSaveInfo' | 'changeSaveCredentials' | 'setFormErrors'
);
export type FormEditDispatch = Dispatch<FormActions>;

const INITIAL_STATE: FormState = {
  streetLine1: '',
  streetLine2: '',
  city: '',
  state: '',
  countryIso2: '',
  postCode: '',
  fullName: '',
  email: '',
  phone: '',
  shipping: '',
  cardNumber: '',
  cardholder: '',
  expiry: '',
  cvv: '',
  billingCountry: '',
  billingZip: '',
  saveInfo: true,
  saveCredentials: false,
  formErrors: {},
};

const reducer: StateReducer<FormState, FormActions> = (state, action) => {
  switch (action.type) {
    case 'changeAddress1':
      return {
        ...state,
        streetLine1: action.payload,
        formErrors: {
          ...state.formErrors,
          streetLine1: undefined,
        },
      };
    case 'changeAddress2':
      return {
        ...state,
        streetLine2: action.payload,
        formErrors: {
          ...state.formErrors,
          streetLine2: undefined,
        },
      };
    case 'changeCity':
      return {
        ...state,
        city: action.payload,
        formErrors: {
          ...state.formErrors,
          city: undefined,
        },
      };
    case 'changeState':
      return {
        ...state,
        state: action.payload,
        formErrors: {
          ...state.formErrors,
          state: undefined,
        },
      };
    case 'changeCountry':
      return {
        ...state,
        countryIso2: action.payload,
        billingCountry: getBillingCountry(action.payload),
        formErrors: {
          ...state.formErrors,
          countryIso2: undefined,
        },
      };
    case 'changePostCode':
      return {
        ...state,
        postCode: action.payload,
        formErrors: {
          ...state.formErrors,
          postCode: undefined,
        },
      };
    case 'changeFullName':
      return {
        ...state,
        fullName: action.payload,
        formErrors: {
          ...state.formErrors,
          fullName: undefined,
        },
      };
    case 'changeEmail':
      return {
        ...state,
        email: action.payload,
        formErrors: {
          ...state.formErrors,
          email: undefined,
        },
      };
    case 'changePhone':
      return {
        ...state,
        phone: action.payload,
        formErrors: {
          ...state.formErrors,
          phone: undefined,
        },
      };
    case 'changeShipping':
      return { ...state, shipping: action.payload };
    case 'changeCardNumber':
      return {
        ...state,
        cardNumber: action.payload,
        formErrors: {
          ...state.formErrors,
          cardNumber: undefined,
        },
      };
    case 'changeCardholder':
      return {
        ...state,
        cardholder: action.payload,
        formErrors: {
          ...state.formErrors,
          cardholder: undefined,
        },
      };
    case 'changeExpiryDate':
      return {
        ...state,
        expiry: action.payload,
        formErrors: {
          ...state.formErrors,
          expiry: undefined,
        },
      };
    case 'changeCvvCode':
      return {
        ...state,
        cvv: action.payload,
        formErrors: {
          ...state.formErrors,
          cvv: undefined,
        },
      };
    case 'changeBillingCountry':
      return {
        ...state,
        billingCountry: action.payload,
        formErrors: {
          ...state.formErrors,
          billingCountry: undefined,
        },
      };
    case 'changeBillingZip':
      return {
        ...state,
        billingZip: action.payload,
        formErrors: {
          ...state.formErrors,
          billingZip: undefined,
        },
      };
    case 'changeSaveInfo':
      return { ...state, saveInfo: action.payload };
    case 'changeSaveCredentials':
      return { ...state, saveCredentials: action.payload };
    case 'updateUserInfo':
      if (action.payload.countryIso2) {
        return {
          ...state,
          ...action.payload,
          billingCountry: getBillingCountry(action.payload.countryIso2),
        };
      }
      return { ...state, ...action.payload };
    case 'setFormErrors':
      return {
        ...state,
        formErrors: {
          ...state.formErrors,
          ...action.payload,
        },
      };
    default:
      return state;
  }
};

function getBillingCountry(countryCode: string) {
  const country = countryList.find(({ id }) => id === countryCode);
  return country ? country.name : '';
}

export default () => {
  return useReducer(reducer, INITIAL_STATE);
};
